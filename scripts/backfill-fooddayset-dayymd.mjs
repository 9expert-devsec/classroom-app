#!/usr/bin/env node
// scripts/backfill-fooddayset-dayymd.mjs
//
// เติม FoodDaySet.dayYMD ("YYYY-MM-DD" เวลาไทย) ให้เอกสารที่ยังไม่มี
//
// ทำไมต้องมี: fooddaysets.date ถูกเขียนไว้ 2 แบบ (UTC midnight กับ Bangkok
// midnight = 17:00Z ของวันก่อนหน้า) การค้นด้วยช่วง $gte/$lt จึงให้ผลต่างกัน
// ตาม timezone ของ server ส่วน toBkkYMD(date) ให้ "วันที่ตั้งใจ" ถูกทั้งสองแบบ
//
// สคริปต์นี้ไม่แตะ field `date` เลย และไม่ลบเอกสารใด ๆ
//
//   node scripts/backfill-fooddayset-dayymd.mjs --db=classroom_phase2
//   node scripts/backfill-fooddayset-dayymd.mjs --db=classroom_phase2 --apply
//   node scripts/backfill-fooddayset-dayymd.mjs --db=classroom_phase2 --resolve=latest
//   node scripts/backfill-fooddayset-dayymd.mjs --db=classroom_phase2 --apply --resolve=latest
//
// ค่าเริ่มต้นคือ DRY RUN เขียนจริงเมื่อใส่ --apply เท่านั้น
// ถ้าเจอ "วันชนกัน" (2 เอกสารได้ dayYMD เดียวกัน) จะพิมพ์รายการแล้ว exit 1
// โดยไม่เขียนอะไรเลย แม้จะสั่ง --apply ก็ตาม
//
// --resolve=latest : แทนที่จะ exit ให้เลือกผู้ชนะของแต่ละวัน = เอกสารที่
// updatedAt ใหม่สุด (ไม่มีก็ใช้ createdAt แล้ว _id) ผู้ชนะได้ dayYMD ส่วนตัวที่
// แพ้ได้ supersededBy = <id ผู้ชนะ> และไม่ได้ dayYMD จึงหาไม่เจอในทุก read path
// ที่ค้นด้วย dayYMD — ไม่มีการลบเอกสาร และไม่แตะ date เช่นเดิม

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

const resolveArg = args.find((a) => a.startsWith("--resolve="));
const RESOLVE = resolveArg ? resolveArg.slice("--resolve=".length).trim() : "";

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
console.log(`  resolve: ${RESOLVE || "(ไม่เลือก — ชนกันแล้วหยุด)"}`);
console.log("─".repeat(64));

if (RESOLVE && RESOLVE !== "latest") {
  die(`--resolve=${RESOLVE} ไม่รองรับ — ตอนนี้มีแค่ --resolve=latest`);
}

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

/* ---------------- ranking helpers ---------------- */

// ผู้ชนะ = updatedAt ใหม่สุด, ไม่มีก็ createdAt, ไม่มีอีกก็ _id (ObjectId เรียงตามเวลา)
function rankTime(d) {
  if (d.updatedAt instanceof Date) return d.updatedAt.getTime();
  if (d.createdAt instanceof Date) return d.createdAt.getTime();
  return 0;
}

function pickWinner(docs) {
  return [...docs].sort((a, b) => {
    const ta = rankTime(a);
    const tb = rankTime(b);
    if (tb !== ta) return tb - ta; // ใหม่สุดมาก่อน
    return String(b._id).localeCompare(String(a._id));
  })[0];
}

function describe(d) {
  const n = Array.isArray(d.entries) ? d.entries.length : 0;
  const iso = d.date instanceof Date ? d.date.toISOString() : String(d.date);
  const up =
    d.updatedAt instanceof Date
      ? d.updatedAt.toISOString()
      : d.createdAt instanceof Date
        ? `${d.createdAt.toISOString()} (createdAt)`
        : "-";
  const modes = (d.entries || []).map((e) => e.mode || "no-mode").join(",");
  return `date=${iso}  updatedAt=${up}  entries=${n}${modes ? ` [${modes}]` : ""}`;
}

/* ---------------- run ---------------- */

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();

try {
  const coll = client.db(DBNAME).collection("fooddaysets");

  const total = await coll.countDocuments({});
  const already = await coll.countDocuments({
    dayYMD: { $exists: true, $nin: [null, ""] },
  });
  // เอกสารที่ถูก supersede ไปแล้วไม่ต้องยุ่งอีก
  const supersededCount = await coll.countDocuments({
    supersededBy: { $exists: true, $ne: null },
  });

  const todo = await coll
    .find({
      $and: [
        {
          $or: [
            { dayYMD: { $exists: false } },
            { dayYMD: null },
            { dayYMD: "" },
          ],
        },
        { $or: [{ supersededBy: { $exists: false } }, { supersededBy: null }] },
      ],
    })
    .project({ date: 1, entries: 1, createdAt: 1, updatedAt: 1 })
    .toArray();

  console.log(`\ntotal fooddaysets   : ${total}`);
  console.log(`already has dayYMD  : ${already}`);
  console.log(`already superseded  : ${supersededCount}`);
  console.log(`to fill             : ${todo.length}`);

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
      .project({ date: 1, dayYMD: 1, entries: 1, createdAt: 1, updatedAt: 1 })
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

  // loserId -> winnerId
  const supersedePlan = [];

  if (collisions.length > 0 && RESOLVE !== "latest") {
    console.log(`\n❌ พบวันที่ชนกัน ${collisions.length} วัน — ไม่เขียนอะไรทั้งสิ้น`);
    console.log("   (รวมด้วยมือ หรือรันใหม่พร้อม --resolve=latest)\n");
    for (const c of collisions) {
      console.log(`  dayYMD = ${c.ymd}${c.note ? `  (${c.note})` : ""}`);
      for (const d of c.docs) {
        console.log(`    _id=${d._id}  ${describe(d)}`);
      }
    }
    process.exit(1);
  }

  if (collisions.length > 0) {
    console.log(`\n⚠️  พบวันที่ชนกัน ${collisions.length} วัน — แก้ด้วย --resolve=latest`);
    console.log("   ผู้ชนะ = updatedAt ใหม่สุด / ผู้แพ้ได้ supersededBy");
    console.log("   ไม่ลบเอกสาร และไม่แตะ date\n");

    for (const c of collisions) {
      const winner = pickWinner(c.docs);
      const losers = c.docs.filter((d) => String(d._id) !== String(winner._id));

      console.log(`  dayYMD = ${c.ymd}${c.note ? `  (${c.note})` : ""}`);
      console.log(`    WINNER _id=${winner._id}  ${describe(winner)}`);
      for (const l of losers) {
        console.log(`    loser  _id=${l._id}  ${describe(l)}`);
        supersedePlan.push({ loserId: l._id, winnerId: winner._id, ymd: c.ymd });
      }

      // เขียน dayYMD ให้เฉพาะผู้ชนะ (ถ้าผู้ชนะมี dayYMD อยู่แล้วก็ไม่ต้องเขียนซ้ำ)
      const winnerNeedsYMD = (planned.get(c.ymd) || []).some(
        (d) => String(d._id) === String(winner._id),
      );
      if (winnerNeedsYMD) planned.set(c.ymd, [winner]);
      else planned.delete(c.ymd);
    }
  } else {
    console.log("\n✅ ไม่พบวันที่ชนกัน");
  }

  const preview = Array.from(planned.entries()).slice(0, 5);
  if (preview.length > 0) {
    console.log("\nตัวอย่างที่จะเขียน dayYMD (สูงสุด 5):");
    for (const [ymd, docs] of preview) {
      const d = docs[0];
      const iso = d.date instanceof Date ? d.date.toISOString() : String(d.date);
      console.log(`  ${d._id}  date=${iso}  ->  dayYMD=${ymd}`);
    }
  }

  if (!APPLY) {
    console.log(
      `\nDRY RUN: จะเขียน dayYMD ${planned.size} เอกสาร` +
        `, supersededBy ${supersedePlan.length} เอกสาร — ใส่ --apply เพื่อเขียนจริง`,
    );
  } else if (planned.size === 0 && supersedePlan.length === 0) {
    console.log("\nไม่มีอะไรต้องเขียน");
  } else {
    const ops = [];

    // ผู้แพ้ก่อน: ปลด dayYMD ออกจากสมการให้เรียบร้อยก่อนเขียนของผู้ชนะ
    for (const s of supersedePlan) {
      ops.push({
        updateOne: {
          filter: { _id: s.loserId },
          update: { $set: { supersededBy: s.winnerId } }, // ไม่ให้ dayYMD, ไม่แตะ date
        },
      });
    }

    for (const [ymd, docs] of planned.entries()) {
      ops.push({
        updateOne: {
          filter: { _id: docs[0]._id },
          update: { $set: { dayYMD: ymd } }, // ห้ามแตะ date
        },
      });
    }

    const res = await coll.bulkWrite(ops, { ordered: true });
    console.log(
      `\nเขียนแล้ว: matched=${res.matchedCount} modified=${res.modifiedCount}` +
        ` (dayYMD ${planned.size}, supersededBy ${supersedePlan.length})`,
    );

    const remaining = await coll.countDocuments({
      $and: [
        {
          $or: [
            { dayYMD: { $exists: false } },
            { dayYMD: null },
            { dayYMD: "" },
          ],
        },
        { $or: [{ supersededBy: { $exists: false } }, { supersededBy: null }] },
      ],
    });
    console.log(`เหลือที่ยังไม่มี dayYMD (ไม่นับที่ถูก supersede): ${remaining}`);
  }

  console.log("\nDONE\n");
} finally {
  await client.close();
}
