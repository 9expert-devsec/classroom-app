#!/usr/bin/env node
// scripts/repair-stale-coupon-note.mjs
//
// R1: ล้างโน้ต "COUPON" ที่ค้างอยู่ใน Student.food ของคนที่ไม่ได้เลือกคูปองแล้ว
//
// ทำไมต้องมี: หน้าแก้ไขเมนูบนแท็บเล็ตเคย prefill ผู้เรียนคูปองเป็น "ไม่รับอาหาร"
// โดยโน้ตยังเป็น "COUPON" (coupon ถูกเก็บพร้อม noFood: true) กดบันทึกแล้วได้
// { choiceType: "noFood", note: "COUPON" } ซึ่ง Food Report เดิมนับเป็นคูปอง
//
// เป้าหมาย: Student ที่ food.choiceType มีค่าและไม่ใช่ "coupon"
//           และ food.note เป็น "COUPON" (ไม่สนตัวพิมพ์ / ช่องว่างหัวท้าย)
// แก้:      noFood -> note = "ไม่รับอาหาร", อย่างอื่น -> note = ""
//           แตะเฉพาะ food.note — ไม่แตะ field อื่น และไม่แตะ Checkin.food (เป็นประวัติตอนเช็คอิน)
//
//   node scripts/repair-stale-coupon-note.mjs            (DRY RUN)
//   node scripts/repair-stale-coupon-note.mjs --apply    (เขียนจริง — เฉพาะ db classroom_phase2)
//
// ก่อนเขียนจริงจะ backup food ของเอกสารที่โดนแก้ไว้ที่ tmp/ (ห้าม commit)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const { MongoClient } = require(path.join(REPO_ROOT, "node_modules/mongodb"));

const APPLY_DB = "classroom_phase2";

/* ---------------- args ---------------- */

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

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

// โชว์ scheme + host เท่านั้น ไม่โชว์ credential
function maskUri(uri) {
  return String(uri)
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@]*@/i, "$1***:***@")
    .replace(/\?.*$/, "");
}

/* ---------------- rule ---------------- */

function isStaleCouponNote(note) {
  return String(note ?? "").trim().toLowerCase() === "coupon";
}

function nextNote(choiceType) {
  return choiceType === "noFood" ? "ไม่รับอาหาร" : "";
}

/* ---------------- main ---------------- */

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  try {
    const db = client.db(DBNAME);

    console.log("─".repeat(64));
    console.log("Student.food stale COUPON note repair");
    console.log(`  host : ${maskUri(URI)}`);
    console.log(`  db   : ${db.databaseName}`);
    console.log(`  mode : ${APPLY ? "APPLY (เขียนจริง)" : "DRY RUN (อ่านอย่างเดียว)"}`);
    console.log("─".repeat(64));

    if (APPLY && db.databaseName !== APPLY_DB) {
      die(`--apply ใช้ได้เฉพาะ db "${APPLY_DB}" เท่านั้น (ตอนนี้ต่อ "${db.databaseName}")`);
    }

    const students = db.collection("students");
    const candidates = await students
      .find(
        {
          "food.choiceType": { $exists: true, $nin: ["", null, "coupon"] },
          "food.note": { $regex: /^\s*coupon\s*$/i },
        },
        { projection: { name: 1, food: 1 } },
      )
      .toArray();

    // กรองซ้ำด้วยกติกาเดียวกับโค้ด (กัน regex ของ driver ต่างจากที่ตั้งใจ)
    const targets = candidates.filter(
      (s) => s.food?.choiceType && s.food.choiceType !== "coupon" && isStaleCouponNote(s.food.note),
    );

    console.log(`พบ ${targets.length} เอกสาร`);
    for (const s of targets) {
      console.log(
        `  ${s._id}  ${s.name || "-"}  choiceType=${s.food.choiceType}  ` +
          `note ${JSON.stringify(s.food.note)} -> ${JSON.stringify(nextNote(s.food.choiceType))}`,
      );
    }

    if (!APPLY) {
      console.log("\nDRY RUN — ไม่ได้เขียนอะไร (ใส่ --apply เพื่อเขียนจริง)");
      return;
    }
    if (!targets.length) {
      console.log("\nไม่มีอะไรต้องแก้");
      return;
    }

    // backup ก่อนเขียน
    const tmpDir = path.join(REPO_ROOT, "tmp");
    fs.mkdirSync(tmpDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(tmpDir, `repair-stale-coupon-note-${db.databaseName}-${stamp}.json`);
    fs.writeFileSync(
      backupPath,
      JSON.stringify(
        targets.map((s) => ({ _id: String(s._id), name: s.name || "", food: s.food })),
        null,
        2,
      ),
      "utf8",
    );
    console.log(`\nbackup: ${backupPath}`);

    let written = 0;
    for (const s of targets) {
      // conditional: note ต้องยังเป็นค่าเดิมตอนอ่าน
      const r = await students.updateOne(
        { _id: s._id, "food.choiceType": s.food.choiceType, "food.note": s.food.note },
        { $set: { "food.note": nextNote(s.food.choiceType) } },
      );
      written += r.modifiedCount;
    }
    console.log(`เขียนแล้ว ${written} / ${targets.length} เอกสาร`);
  } finally {
    await client.close();
  }
}

main().catch((e) => die(e?.stack || e?.message || String(e)));
