#!/usr/bin/env node
// scripts/backfill-food-choices.mjs
//
// R4-1D: เติม FoodChoice (collection food_choices) ย้อนหลัง 1 แถวต่อ (ผู้เรียน, คลาส, วันเรียน)
//
// แหล่งข้อมูลต่อ key (เรียงตามลำดับ):
//   1) FoodEditLog แถวล่าสุดของ key นั้น  -> source "backfill", backfillFrom "food_edit_log"
//   2) ไม่มี -> Student.food เมื่อ classId + day ประทับไว้ตรง key -> backfillFrom "student_food"
//   3) ไม่มีทั้งคู่ -> ไม่สร้างแถว (ไม่มีแถว = วันนั้นยังไม่ได้เลือก)
// dayYMD จาก days[] ของคลาส (ไม่มี days[] -> date + (day-1) เมื่อ day <= จำนวนวัน) — แปลงไม่ได้ = ข้าม (นับไว้)
// insert-only: แถวที่มีอยู่แล้วไม่แตะ (นับเป็น already present) — รันซ้ำได้ (idempotent)
//
//   node scripts/backfill-food-choices.mjs                                   (DRY RUN — classroom_phase2)
//   node scripts/backfill-food-choices.mjs --apply                           (เขียนจริง — classroom_phase2)
//   node scripts/backfill-food-choices.mjs --db=classroom --i-mean-production [--apply]
//                                                                            (production — สำหรับวัน go-live เท่านั้น)
// รายงาน JSON เขียนไว้ที่ temp dir ของเครื่อง (scripts/out ไม่ได้อยู่ใน .gitignore) และพิมพ์ path ให้

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const { MongoClient, ObjectId } = require(path.join(REPO_ROOT, "node_modules/mongodb"));

const PHASE2_DB = "classroom_phase2";
const PROD_DB = "classroom";
const CHOICES = new Set(["food", "noFood", "coupon"]);

/* ---------------- args ---------------- */

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const PROD_OK = args.includes("--i-mean-production");
const dbArg = (args.find((a) => a.startsWith("--db=")) || "").slice("--db=".length);

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
      return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const URI = env.MONGODB_URI || "";
if (!URI) die("ไม่พบ MONGODB_URI ใน .env.local");

// เลือก db: phase2 ได้เมื่อ .env.local ชี้ classroom_phase2 · production ต้องระบุทั้ง --db=classroom และ --i-mean-production
let DBNAME;
if (dbArg === PROD_DB) {
  if (!PROD_OK) die(`--db=${PROD_DB} ต้องใส่ --i-mean-production ด้วย`);
  DBNAME = PROD_DB;
} else if (dbArg && dbArg !== PHASE2_DB) {
  die(`--db ใช้ได้แค่ ${PHASE2_DB} หรือ ${PROD_DB} (ตอนนี้ "${dbArg}")`);
} else {
  if (env.MONGODB_DBNAME !== PHASE2_DB) {
    die(`MONGODB_DBNAME ต้องเป็น ${PHASE2_DB} (ตอนนี้ "${env.MONGODB_DBNAME || ""}")`);
  }
  DBNAME = PHASE2_DB;
}

function maskUri(uri) {
  return String(uri)
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@]*@/i, "$1***:***@")
    .replace(/\?.*$/, "");
}

/* ---------------- date helpers (Asia/Bangkok — เหมือน src/lib/classDates.js) ---------------- */

function bangkokYMD(x) {
  if (!x) return "";
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addDaysYMD(ymd, n) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayCountOf(c) {
  const n = Number(c?.dayCount || c?.duration?.dayCount || 0);
  if (n > 0) return n;
  return Array.isArray(c?.days) && c.days.length ? c.days.length : 1;
}

/** วันเรียนที่ day ของคลาส -> "YYYY-MM-DD" · แปลงไม่ได้ = "" */
function classDayYMD(c, day) {
  const n = Number(day);
  if (!Number.isInteger(n) || n < 1) return "";
  if (Array.isArray(c?.days) && c.days.length) {
    const v = c.days[n - 1];
    return v ? String(v).slice(0, 10) : "";
  }
  if (n > dayCountOf(c)) return "";
  const start = bangkokYMD(c?.date);
  return start ? addDaysYMD(start, n - 1) : "";
}

/* ---------------- food shape (เหมือน pickFoodChoiceFields ใน src/lib/foodChoice.server.js) ---------------- */

function pickFood(f) {
  const strArr = (a) => (Array.isArray(a) ? a.map((x) => String(x)) : []);
  return {
    choiceType: CHOICES.has(f?.choiceType) ? f.choiceType : "",
    noFood: f?.noFood === undefined ? true : !!f.noFood,
    restaurantId: String(f?.restaurantId || ""),
    menuId: String(f?.menuId || ""),
    addons: strArr(f?.addons),
    drink: String(f?.drink || ""),
    addonIds: strArr(f?.addonIds),
    drinkId: String(f?.drinkId || ""),
    note: String(f?.note || ""),
  };
}

const keyOf = (studentId, classId, day) => `${studentId}:${classId}:${day}`;
const isOid = (x) => ObjectId.isValid(String(x || "")) && String(new ObjectId(String(x))) === String(x);

/* ---------------- main ---------------- */

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  try {
    const db = client.db(DBNAME);

    console.log("─".repeat(64));
    console.log("FoodChoice backfill");
    console.log(`  host : ${maskUri(URI)}`);
    console.log(`  db   : ${db.databaseName}`);
    console.log(`  mode : ${APPLY ? "APPLY (insert-only)" : "DRY RUN (อ่านอย่างเดียว)"}`);
    console.log("─".repeat(64));

    // 1) candidates: FoodEditLog ล่าสุดต่อ key
    const candidates = new Map(); // key -> { studentId, classId, day, food, from, at }
    const counts = {
      foodEditLogRows: 0,
      foodEditLogKeys: 0,
      studentFoodKeys: 0,
      skipped: {
        invalidKey: 0,
        emptyChoice: 0,
        orphanStudent: 0,
        orphanClass: 0,
        studentNotInClass: 0,
        unmappableDay: 0,
      },
      alreadyPresent: 0,
      toInsert: { food_edit_log: 0, student_food: 0 },
      inserted: 0,
    };

    const felCursor = db
      .collection("foodeditlogs")
      .find({}, { projection: { studentId: 1, classId: 1, day: 1, createdAt: 1, choiceType: 1, noFood: 1, restaurantId: 1, menuId: 1, addonIds: 1, drinkId: 1, note: 1 } })
      .sort({ createdAt: 1, _id: 1 });
    for await (const r of felCursor) {
      counts.foodEditLogRows += 1;
      const sid = String(r.studentId || "");
      const cid = String(r.classId || "");
      const day = Number(r.day);
      if (!isOid(sid) || !isOid(cid) || !Number.isInteger(day) || day < 1) {
        counts.skipped.invalidKey += 1;
        continue;
      }
      // เรียงเก่า -> ใหม่ จึงทับด้วยแถวใหม่กว่าเสมอ = แถวล่าสุดของ key
      // FoodEditLog ไม่มี addons/drink (ชื่อแบบเก่า) — เหลือว่างตามรูปเดิม
      candidates.set(keyOf(sid, cid, day), {
        studentId: sid,
        classId: cid,
        day,
        food: r,
        from: "food_edit_log",
        at: r.createdAt || null,
      });
    }
    counts.foodEditLogKeys = candidates.size;

    // 2) Student.food ที่ประทับ classId + day — ใช้เฉพาะ key ที่ FoodEditLog ไม่มี
    const stuCursor = db
      .collection("students")
      .find({ "food.day": { $ne: null } }, { projection: { classId: 1, food: 1, updatedAt: 1 } });
    for await (const s of stuCursor) {
      const f = s.food || {};
      const sid = String(s._id);
      const cid = String(f.classId || "");
      const day = Number(f.day);
      if (!isOid(cid) || !Number.isInteger(day) || day < 1) continue;
      const k = keyOf(sid, cid, day);
      if (candidates.has(k)) continue;
      candidates.set(k, { studentId: sid, classId: cid, day, food: f, from: "student_food", at: s.updatedAt || null });
      counts.studentFoodKeys += 1;
    }

    // 3) ตรวจ student / class / day -> doc
    const studentIds = [...new Set([...candidates.values()].map((c) => c.studentId))];
    const classIds = [...new Set([...candidates.values()].map((c) => c.classId))];
    const students = new Map();
    for (let i = 0; i < studentIds.length; i += 1000) {
      const batch = studentIds.slice(i, i + 1000).map((x) => new ObjectId(x));
      for (const s of await db.collection("students").find({ _id: { $in: batch } }, { projection: { classId: 1 } }).toArray()) {
        students.set(String(s._id), s);
      }
    }
    const classes = new Map();
    for (const c of await db
      .collection("classes")
      .find({ _id: { $in: classIds.map((x) => new ObjectId(x)) } }, { projection: { title: 1, courseName: 1, customCourseName: 1, date: 1, days: 1, dayCount: 1, "duration.dayCount": 1 } })
      .toArray()) {
      classes.set(String(c._id), c);
    }

    const existing = new Set(
      (
        await db
          .collection("food_choices")
          .find({}, { projection: { studentId: 1, classId: 1, day: 1 } })
          .toArray()
      ).map((r) => keyOf(String(r.studentId), String(r.classId), r.day)),
    );

    const docs = [];
    const perClass = new Map();
    for (const [k, c] of candidates) {
      if (!CHOICES.has(c.food?.choiceType)) {
        counts.skipped.emptyChoice += 1;
        continue;
      }
      const stu = students.get(c.studentId);
      if (!stu) {
        counts.skipped.orphanStudent += 1;
        continue;
      }
      const klass = classes.get(c.classId);
      if (!klass) {
        counts.skipped.orphanClass += 1;
        continue;
      }
      if (String(stu.classId || "") !== c.classId) {
        counts.skipped.studentNotInClass += 1;
        continue;
      }
      const dayYMD = classDayYMD(klass, c.day);
      if (!dayYMD) {
        counts.skipped.unmappableDay += 1;
        continue;
      }
      if (existing.has(k)) {
        counts.alreadyPresent += 1;
        continue;
      }

      const at = c.at ? new Date(c.at) : new Date();
      docs.push({
        studentId: new ObjectId(c.studentId),
        classId: new ObjectId(c.classId),
        day: c.day,
        dayYMD,
        ...pickFood(c.food),
        source: "backfill",
        backfillFrom: c.from,
        updatedBy: "backfill",
        createdAt: at,
        updatedAt: at,
      });
      counts.toInsert[c.from] += 1;

      const pc = perClass.get(c.classId) || {
        classId: c.classId,
        title: klass.customCourseName || klass.courseName || klass.title || "",
        days: new Set(),
        learnerDays: 0,
        fromFoodEditLog: 0,
        fromStudentFood: 0,
      };
      pc.days.add(c.day);
      pc.learnerDays += 1;
      if (c.from === "food_edit_log") pc.fromFoodEditLog += 1;
      else pc.fromStudentFood += 1;
      perClass.set(c.classId, pc);
    }

    // ช่วงที่ R4-0 สำรวจไว้ (เทียบ sanity check)
    const R40_FROM = "2026-08-22";
    const R40_TO = "2026-10-20";
    const inR40Window = docs.filter((d) => d.dayYMD >= R40_FROM && d.dayYMD <= R40_TO).length;

    if (APPLY && docs.length) {
      // index ก่อนเขียน (เหมือน src/models/FoodChoice.js) — unique กันซ้ำแม้รันพร้อมกัน
      const col = db.collection("food_choices");
      await col.createIndexes([
        { key: { studentId: 1, classId: 1, day: 1 }, name: "studentId_1_classId_1_day_1", unique: true },
        { key: { classId: 1, dayYMD: 1 }, name: "classId_1_dayYMD_1" },
        { key: { dayYMD: 1 }, name: "dayYMD_1" },
      ]);
      for (let i = 0; i < docs.length; i += 500) {
        try {
          const res = await col.insertMany(docs.slice(i, i + 500), { ordered: false });
          counts.inserted += res.insertedCount;
        } catch (e) {
          // E11000 = มีคนเขียนแถวเดียวกันไปก่อน -> ไม่ทับ (insert-only)
          const inserted = e?.result?.insertedCount ?? e?.insertedCount ?? 0;
          const dupOnly = (e?.writeErrors || []).every((w) => (w.code ?? w.err?.code) === 11000);
          if (!dupOnly) throw e;
          counts.inserted += inserted;
          counts.alreadyPresent += (e.writeErrors || []).length;
        }
      }
    }

    const perClassOut = [...perClass.values()]
      .map((p) => ({ ...p, days: [...p.days].sort((a, b) => a - b) }))
      .sort((a, b) => b.learnerDays - a.learnerDays);

    const report = {
      db: db.databaseName,
      mode: APPLY ? "apply" : "dry-run",
      ranAt: new Date().toISOString(),
      counts,
      wouldInsert: docs.length,
      wouldInsertInR40Window: { window: `${R40_FROM}..${R40_TO}`, learnerDays: inR40Window },
      perClass: perClassOut,
    };

    console.log(JSON.stringify({ ...report, perClass: undefined }, null, 2));
    console.log("\nper class (classId · days · learner-days · from FEL / Student.food · title):");
    for (const p of perClassOut) {
      console.log(
        `  ${p.classId}  days ${p.days.join(",")}  ${p.learnerDays}  (${p.fromFoodEditLog}/${p.fromStudentFood})  ${p.title}`,
      );
    }

    const outPath = path.join(
      os.tmpdir(),
      `backfill-food-choices_${db.databaseName}_${report.mode}_${Date.now()}.json`,
    );
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`\nreport: ${outPath}`);
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
