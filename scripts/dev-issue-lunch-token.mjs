#!/usr/bin/env node
// scripts/dev-issue-lunch-token.mjs
//
// ออก token สำหรับทดสอบหน้าสั่งอาหารบนมือถือ
//
//   node scripts/dev-issue-lunch-token.mjs --student <id> --class <id> --day 2026-09-25
//
// ป้องกันไว้เฉพาะ classroom_phase2 เท่านั้น ยิงผิด db ไม่ได้
// idempotent เหมือน issueLunchOrder: เรียกซ้ำได้ token เดิม

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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

/* ---------------- args ---------------- */

const args = process.argv.slice(2);
function argOf(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? String(args[i + 1] || "").trim() : "";
}

const studentId = argOf("student");
const classId = argOf("class");
const dayArg = argOf("day");

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
if (DBNAME !== "classroom_phase2") {
  die(`สคริปต์นี้รันได้เฉพาะ classroom_phase2 เท่านั้น (ตอนนี้คือ "${DBNAME}")`);
}

if (!studentId || !classId) {
  die(
    "ใช้งาน: node scripts/dev-issue-lunch-token.mjs --student <id> --class <id> [--day YYYY-MM-DD]",
  );
}

/* ---------------- bangkok day ---------------- */

const bkkFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const toBkkYMD = (d = new Date()) => bkkFmt.format(new Date(d));

const dayYMD = /^\d{4}-\d{2}-\d{2}$/.test(dayArg) ? dayArg : toBkkYMD();

/* ---------------- run ---------------- */

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();

try {
  const db = client.db(DBNAME);
  const Orders = db.collection("lunchorders");

  const klass = await db
    .collection("classes")
    .findOne({ _id: new ObjectId(classId) });
  if (!klass) die("ไม่พบคลาส");
  if (klass.disableCoupon) die("คลาสนี้ปิดการใช้คูปองไว้ (disableCoupon)");

  const student = await db
    .collection("students")
    .findOne({ _id: new ObjectId(studentId) });
  if (!student) die("ไม่พบผู้เรียน");

  // วันนั้นต้องมีร้านโหมด coupon ที่เปิดใช้งานจริง
  const daySet = await db.collection("fooddaysets").findOne({ dayYMD });
  const couponIds = (daySet?.entries || [])
    .filter((e) => e.mode === "coupon")
    .map((e) => e.restaurant);

  if (couponIds.length === 0) {
    die(`วันที่ ${dayYMD} ยังไม่มีร้านโหมด coupon ใน Food Calendar`);
  }

  const usable = await db
    .collection("restaurants")
    .find({ _id: { $in: couponIds }, couponEnabled: true, isActive: { $ne: false } })
    .toArray();
  if (usable.length === 0) {
    die(`วันที่ ${dayYMD} ไม่มีร้านคูปองที่เปิดใช้งาน`);
  }

  const activeKey = `${classId}:${studentId}:${dayYMD}`;

  // สคริปต์นี้เขียนผ่าน driver ตรง ๆ ไม่ผ่าน mongoose ถ้ามันสร้าง collection
  // ขึ้นมาก่อนที่ Next จะโหลด model สักครั้ง จะยังไม่มี index ที่กันซ้ำเลย
  // จึงต้องมั่นใจก่อนเสมอว่า unique index มีอยู่จริง
  await Orders.createIndex({ activeKey: 1 }, { unique: true, sparse: true });
  await Orders.createIndex({ token: 1 }, { unique: true, sparse: true });

  let order = await Orders.findOne({ activeKey });

  if (!order) {
    const token = crypto.randomBytes(32).toString("base64url");
    const [y, m, d] = dayYMD.split("-").map(Number);
    // 11:15 เวลาไทย = 04:15 UTC
    const deadlineAt = new Date(Date.UTC(y, m - 1, d, 4, 15, 0, 0));

    const doc = {
      classId: new ObjectId(classId),
      studentId: new ObjectId(studentId),
      dayYMD,
      day: 1,
      activeKey,
      token,
      tokenIssuedAt: new Date(),
      deadlineAt,
      reopenCount: 0,
      status: "pending",
      nickname: "",
      holderName: student.name || student.thaiName || student.engName || "",
      courseName:
        klass.customCourseName || klass.courseName || klass.title || "",
      roomName: klass.room || "",
      restaurantId: null,
      restaurantName: "",
      usesCouponStock: false,
      lines: [],
      itemsTotal: 0,
      budget: 180,
      overBudget: 0,
      couponCode: "",
      couponSource: "",
      stockCodeId: null,
      submittedAt: null,
      cancelledAt: null,
      cancelledBy: "",
      cancelReason: "",
      printedAt: null,
      printedCouponCode: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const res = await Orders.insertOne(doc);
      order = { ...doc, _id: res.insertedId };
    } catch (err) {
      if (err?.code === 11000) {
        order = await Orders.findOne({ activeKey });
      } else {
        throw err;
      }
    }
  }

  console.log("");
  console.log(`db        : ${DBNAME}`);
  console.log(`class     : ${klass.title || klass.courseName || classId}`);
  console.log(`student   : ${order.holderName || studentId}`);
  console.log(`dayYMD    : ${dayYMD}`);
  console.log(`orderId   : ${order._id}`);
  console.log(`status    : ${order.status}`);
  console.log("");
  console.log(`/lunch/${order.token}`);
  console.log("");
} finally {
  await client.close();
}
