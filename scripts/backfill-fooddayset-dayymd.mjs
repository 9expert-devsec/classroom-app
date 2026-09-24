#!/usr/bin/env node
// scripts/backfill-fooddayset-dayymd.mjs
//
// เติม FoodDaySet.dayYMD ("YYYY-MM-DD" เวลาไทย) ให้เอกสารที่ยังไม่มี
//
// ทำไมต้องมี: fooddaysets.date ถูกเขียนไว้ 2 แบบ (UTC midnight กับ Bangkok
// midnight = 17:00Z ของวันก่อนหน้า) การค้นด้วยช่วง $gte/$lt จึงให้ผลต่างกัน
// ตาม timezone ของ server ส่วน toBkkYMD(date) ให้ "วันที่ตั้งใจ" ถูกทั้งสองแบบ
//
// สคริปต์นี้ไม่แตะ field `date` เลย — $set เฉพาะ dayYMD
//
//   node scripts/backfill-fooddayset-dayymd.mjs --db=classroom_phase2
//   node scripts/backfill-fooddayset-dayymd.mjs --db=classroom_phase2 --apply
//
// ค่าเริ่มต้นคือ DRY RUN เขียนจริงเมื่อใส่ --apply เท่านั้น
// ถ้าเจอ "วันชนกัน" (2 เอกสารได้ dayYMD เดียวกัน) จะพิมพ์รายการแล้ว exit 1
// โดยไม่เขียนอะไรเลย แม้จะสั่ง --apply ก็ตาม

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const { MongoClient } = require(path.join(REPO_ROOT, "node_modules/mongodb"));

/* ---------------- args ---------------- */

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const dbArg = args.find((a) => a.startsWith("--db="));
const REQUESTED_DB = dbArg ? dbArg.slice("--db=".length).trim() : "";

function die(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

/* ---------------- env ---------------- */

const envPath = path.join(REPO_ROOT, ".env.local");
if (!fs.existsSync(envPath)) die(`ไม่พบไฟล์ ${envPath}`);

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Za-z0-9_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim()];
    }),
);

const URI = env.MONGODB_URI || "";
const DBNAME = env.MONGODB_DBNAME || "";

if (!URI) die("ไม่พบ MONGODB_URI ใน .env.local");
if (!DBNAME) die("ไม่พบ MONGODB_DBNAME ใน .env.local");

// โชว์ scheme + host + db เท่านั้น ไม่โชว์ credential
function maskUri(uri) {
  return String(uri)
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@]*@/i, "$1***:***@")
    .replace(/\?.*$/, "");
}

console.log("─".repeat(64));
console.log("FoodDaySet.dayYMD backfill");
console.log(`  host   : ${maskUri(URI)}`);
console.log(`  db     : ${DBNAME}`);
console.log(`  mode   : ${APPLY ? "APPLY (เขียนจริง)" : "DRY RUN (อ่านอย่างเดียว)"}`);
console.log("─".repeat(64));

if (!REQUESTED_DB) {
  die(
    `ต้องระบุ --db=<ชื่อ db> ให้ตรงกับ MONGODB_DBNAME เพื่อยืนยันปลายทาง\n` +
      `   ที่ถูกต้องคือ: --db=${DBNAME}`,
  );
}
if (REQUESTED_DB !== DBNAME) {
  die(
    `--db=${REQUESTED_DB} ไม่ตรงกับ MONGODB_DBNAME (${DBNAME}) — ยกเลิกเพื่อกันยิงผิด db`,
  );
}

/* ---------------- Bangkok day key ---------------- */
// ตรงกับ toBkkYMD() ใน src/lib/lunchConfig.js — Intl ล้วน ไม่อ่าน field ของ
// server-local date และไม่ฮาร์ดโค้ด +07

const bkkFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toBkkYMD(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return bkkFmt.format(d);
}

/* ---------------- run ---------------- */

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();

try {
  const coll = client.db(DBNAME).collection("fooddaysets");

  const total = await coll.countDocuments({});
  const already = await coll.countDocuments({
    dayYMD: { $exists: true, $ne: null, $ne: "" },
  });

  const todo = await coll
    .find({ $or: [{ dayYMD: { $exists: false } }, { dayYMD: null }, { dayYMD: "" }] })
    .project({ date: 1, entries: 1 })
    .toArray();

  console.log(`\nfooddaysets ทั้งหมด        : ${total}`);
  console.log(`มี dayYMD อยู่แล้ว         : ${already}`);
  console.log(`ต้องเติม                  : ${todo.length}`);

  // map: dayYMD -> docs ที่จะได้ค่านั้น
  const planned = new Map();
  const bad = [];

  for (const doc of todo) {
    const ymd = toBkkYMD(doc.date);
    if (!ymd) {
      bad.push(doc);
      continue;
    }
    if (!planned.has(ymd)) planned.set(ymd, []);
    planned.get(ymd).push(doc);
  }

  if (bad.length > 0) {
    console.log(`\n⚠️  แปลง date ไม่ได้ ${bad.length} เอกสาร (จะข้าม):`);
    for (const d of bad.slice(0, 10)) {
      console.log(`    ${d._id}  date=${JSON.stringify(d.date)}`);
    }
  }

  // ชนกันเองภายในกลุ่มที่จะเติม
  const collisions = [];
  for (const [ymd, docs] of planned.entries()) {
    if (docs.length > 1) collisions.push({ ymd, docs });
  }

  // ชนกับเอกสารที่มี dayYMD อยู่แล้ว
  const wantedYMDs = Array.from(planned.keys());
  if (wantedYMDs.length > 0) {
    const existing = await coll
      .find({ dayYMD: { $in: wantedYMDs } })
      .project({ date: 1, dayYMD: 1, entries: 1 })
      .toArray();

    for (const ex of existing) {
      const docs = planned.get(ex.dayYMD) || [];
      collisions.push({
        ymd: ex.dayYMD,
        docs: [...docs, ex],
        note: "ชนกับเอกสารที่มี dayYMD อยู่แล้ว",
      });
    }
  }

  if (collisions.length > 0) {
    console.log(`\n❌ พบวันที่ชนกัน ${collisions.length} วัน — ไม่เขียนอะไรทั้งสิ้น`);
    console.log("   (ต้องรวม/ลบเอกสารซ้ำด้วยมือก่อน แล้วรันใหม่)\n");
    for (const c of collisions) {
      console.log(`  dayYMD = ${c.ymd}${c.note ? `  (${c.note})` : ""}`);
      for (const d of c.docs) {
        const n = Array.isArray(d.entries) ? d.entries.length : 0;
        const iso = d.date instanceof Date ? d.date.toISOString() : String(d.date);
        console.log(`    _id=${d._id}  date=${iso}  entries=${n}`);
      }
    }
    process.exit(1);
  }

  console.log("\n✅ ไม่พบวันที่ชนกัน");

  const preview = Array.from(planned.entries()).slice(0, 5);
  if (preview.length > 0) {
    console.log("\nตัวอย่างที่จะเขียน (สูงสุด 5):");
    for (const [ymd, docs] of preview) {
      const d = docs[0];
      const iso = d.date instanceof Date ? d.date.toISOString() : String(d.date);
      console.log(`  ${d._id}  date=${iso}  ->  dayYMD=${ymd}`);
    }
  }

  if (!APPLY) {
    console.log(`\nDRY RUN: จะเขียน ${planned.size} เอกสาร — ใส่ --apply เพื่อเขียนจริง`);
  } else if (planned.size === 0) {
    console.log("\nไม่มีอะไรต้องเขียน");
  } else {
    const ops = [];
    for (const [ymd, docs] of planned.entries()) {
      ops.push({
        updateOne: {
          filter: { _id: docs[0]._id },
          update: { $set: { dayYMD: ymd } }, // ห้ามแตะ date
        },
      });
    }
    const res = await coll.bulkWrite(ops, { ordered: false });
    console.log(`\nเขียนแล้ว: matched=${res.matchedCount} modified=${res.modifiedCount}`);

    const remaining = await coll.countDocuments({
      $or: [{ dayYMD: { $exists: false } }, { dayYMD: null }, { dayYMD: "" }],
    });
    console.log(`เหลือที่ยังไม่มี dayYMD   : ${remaining}`);
  }

  console.log("\nDONE\n");
} finally {
  await client.close();
}
