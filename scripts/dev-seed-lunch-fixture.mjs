#!/usr/bin/env node
// scripts/dev-seed-lunch-fixture.mjs
//
// สร้างชุดข้อมูลสำหรับทดสอบ flow สั่งอาหารกลางวันบนมือถือ
//
//   node scripts/dev-seed-lunch-fixture.mjs
//   node scripts/dev-seed-lunch-fixture.mjs --base http://localhost:3000
//
// สิ่งที่ทำ (idempotent — รันซ้ำแล้วไม่เปลี่ยนอะไรเพิ่ม):
//   1) คลาส "LUNCH TEST (dev)" วันเรียน = วันนี้ / +1 / +2 (เวลาไทย) + ผู้เรียน 3 คน
//   2) ตั้ง CASA LAPIN และ Kaizen เป็น mode=coupon ของทั้ง 3 วัน
//   3) นำเข้าคูปอง stock ของ CASA LAPIN 5 ใบ หมดอายุ +30 วัน
//
// ข้อ 2 และ 3 ยิงผ่าน HTTP endpoint ตัวเดียวกับที่หน้า admin ใช้จริง
// (/api/admin/food/days และ /api/admin/food/coupon-stock/import) เพื่อให้
// ผ่าน validation ชุดเดียวกัน ไม่เขียน fooddaysets / couponstockcodes ตรง ๆ
// => ต้องเปิด dev server ไว้ก่อนรันสคริปต์นี้

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const { MongoClient, ObjectId } = require(
  path.join(REPO_ROOT, "node_modules/mongodb"),
);

function die(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

/* ---------------- args + env ---------------- */

const args = process.argv.slice(2);
const baseArg = args.indexOf("--base");
const BASE = baseArg >= 0 ? String(args[baseArg + 1] || "") : "http://localhost:3000";

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

if (!env.MONGODB_URI) die("ไม่พบ MONGODB_URI ใน .env.local");
if (env.MONGODB_DBNAME !== "classroom_phase2") {
  die(
    `สคริปต์นี้รันได้เฉพาะ classroom_phase2 เท่านั้น (ตอนนี้คือ "${env.MONGODB_DBNAME}")`,
  );
}

/* ---------------- bangkok days ---------------- */

const bkkFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const toBkkYMD = (d = new Date()) => bkkFmt.format(new Date(d));
const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00+07:00`);
  d.setDate(d.getDate() + n);
  return toBkkYMD(d);
};

const TODAY = toBkkYMD();
const DAYS = [TODAY, addDays(TODAY, 1), addDays(TODAY, 2)];
const EXPIRY = addDays(TODAY, 30);

const CLASS_TITLE = "LUNCH TEST (dev)";
const BATCH = `DEV-FIXTURE-${TODAY}`;
const STUDENTS = [
  { name: "ทดสอบ หนึ่ง", email: "lunch.dev1@example.invalid" },
  { name: "ทดสอบ สอง", email: "lunch.dev2@example.invalid" },
  { name: "ทดสอบ สาม", email: "lunch.dev3@example.invalid" },
];
const CODES = [
  "DEVFIX-0001", "DEVFIX-0002", "DEVFIX-0003", "DEVFIX-0004", "DEVFIX-0005",
];

/* ---------------- admin session (same auth the admin UI uses) ---------------- */

let cookie = "";

async function adminLogin() {
  const u = env.ADMIN_USERNAME;
  const p = env.ADMIN_PASSWORD;
  if (!u || !p) die("ไม่พบ ADMIN_USERNAME / ADMIN_PASSWORD ใน .env.local");

  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: p }),
  });
  if (!res.ok) {
    die(`ล็อกอิน admin ไม่สำเร็จ (${res.status}) — dev server เปิดอยู่ที่ ${BASE} หรือยัง?`);
  }
  const setCookie = res.headers.getSetCookie?.() || [];
  cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  if (!cookie) die("ล็อกอินสำเร็จแต่ไม่ได้ cookie กลับมา");
}

async function adminPost(pathname, body) {
  const res = await fetch(`${BASE}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    die(`POST ${pathname} -> ${res.status}: ${data?.error || JSON.stringify(data)}`);
  }
  return data;
}

/* ---------------- run ---------------- */

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();

try {
  const db = client.db(env.MONGODB_DBNAME);
  const Classes = db.collection("classes");
  const Students = db.collection("students");
  const Restaurants = db.collection("restaurants");

  console.log("─".repeat(60));
  console.log(`db     : ${env.MONGODB_DBNAME}`);
  console.log(`base   : ${BASE}`);
  console.log(`days   : ${DAYS.join(", ")}`);
  console.log(`expiry : ${EXPIRY}`);
  console.log("─".repeat(60));

  const casa = await Restaurants.findOne({ name: "CASA LAPIN" });
  const kaizen = await Restaurants.findOne({ name: "Kaizen Sushi&Hibachi" });
  if (!casa) die('ไม่พบร้าน "CASA LAPIN"');
  if (!kaizen) die('ไม่พบร้าน "Kaizen Sushi&Hibachi"');

  // ---- 1) class ----
  const now = new Date();
  await Classes.updateOne(
    { title: CLASS_TITLE },
    {
      $set: {
        days: DAYS,
        date: new Date(`${DAYS[0]}T00:00:00+07:00`),
        room: "Dev Room",
        courseName: CLASS_TITLE,
        disableCoupon: false,
        classKind: "normal",
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  const klass = await Classes.findOne({ title: CLASS_TITLE });
  console.log(`\nclass    : ${klass._id}  "${CLASS_TITLE}"`);

  // ---- 1b) students ----
  const studentIds = [];
  for (const st of STUDENTS) {
    await Students.updateOne(
      { classId: klass._id, email: st.email },
      {
        $set: { name: st.name, classId: klass._id, type: "classroom", updatedAt: now },
        $setOnInsert: { createdAt: now, food: {} },
      },
      { upsert: true },
    );
    const doc = await Students.findOne({ classId: klass._id, email: st.email });
    studentIds.push(doc._id);
    console.log(`student  : ${doc._id}  ${st.name}`);
  }

  // ---- 2) coupon days, through the admin Food Calendar endpoint ----
  await adminLogin();
  for (const day of DAYS) {
    const out = await adminPost("/api/admin/food/days", {
      date: day,
      items: [
        { restaurantId: String(casa._id), mode: "coupon", setId: null },
        { restaurantId: String(kaizen._id), mode: "coupon", setId: null },
      ],
    });
    console.log(`daySet   : ${out?.item?._id}  ${day}  (CASA + Kaizen = coupon)`);
  }

  // ---- 3) stock import, through the admin import endpoint ----
  const imported = await adminPost("/api/admin/food/coupon-stock/import", {
    restaurantId: String(casa._id),
    codesText: CODES.join("\n"),
    importBatch: BATCH,
    expiresYMD: EXPIRY,
  });
  console.log(
    `stock    : batch "${BATCH}" inserted=${imported.inserted} ` +
      `(already existed=${imported.counts?.exists ?? 0})`,
  );

  const codeDocs = await db
    .collection("couponstockcodes")
    .find({ restaurant: casa._id, importBatch: BATCH })
    .project({ code: 1, status: 1 })
    .toArray();
  for (const c of codeDocs) console.log(`  code   : ${c._id}  ${c.code}  ${c.status}`);

  console.log("\nลองออก token:");
  console.log(
    `  node scripts/dev-issue-lunch-token.mjs --student ${studentIds[0]} --class ${klass._id} --day ${TODAY} --deadline-minutes 30`,
  );
  console.log("");
} finally {
  await client.close();
}
