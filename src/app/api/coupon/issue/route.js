// src/app/api/coupon/issue/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";
import Class from "@/models/Class";
import Restaurant from "@/models/Restaurant";
import CouponRecord from "@/models/CouponRecord";
import {
  encryptCipher,
  makeRandomToken,
  sha256,
} from "@/lib/couponCipher.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(x) {
  return String(x ?? "").trim();
}

function jsonError(error, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function toBkkYMD(d = new Date()) {
  // ทำง่ายๆ: ใช้ toLocaleDateString แล้วแปลง (พอสำหรับวันเดียว)
  const s = new Date(d).toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
  }); // YYYY-MM-DD
  return s;
}

function endOfBkkDay(ymd) {
  // ymd = "YYYY-MM-DD" -> ตั้งเป็น 23:59:59 BKK โดยประมาณ
  const [y, m, dd] = ymd.split("-").map((n) => Number(n));
  // สร้างเป็น UTC แล้วชดเชยง่ายๆ: BKK = UTC+7
  const utc = new Date(Date.UTC(y, m - 1, dd, 23 - 7, 59, 59, 999));
  return utc;
}

function genDisplayCode() {
  // โค้ดสั้นให้คนอ่าน: 9XP + 4 หลัก
  const n = Math.floor(Math.random() * 10000);
  return `9XP${String(n).padStart(4, "0")}`;
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const studentId = clean(body?.studentId);
  const classId = clean(body?.classId);
  const day = Number(body?.day || 1);

  if (!studentId || !classId) return jsonError("MISSING_IDS");

  await dbConnect();

  const stu = await Student.findById(studentId).lean();
  if (!stu) return jsonError("STUDENT_NOT_FOUND", 404);

  // ✅ กันยิงมั่ว: ออกคูปองได้เฉพาะคนที่เลือก coupon จริง
  const choiceType = stu?.food?.choiceType || "";
  if (choiceType !== "coupon") return jsonError("NOT_COUPON_CHOICE", 409);

  const cls = await Class.findById(classId).lean();
  if (!cls) return jsonError("CLASS_NOT_FOUND", 404);

  const dayYMD = toBkkYMD(new Date()); // หรือถ้าคุณมี dayDates ใช้ day นั้นได้
  const expiresAt = endOfBkkDay(dayYMD);

  // ✅ ดึง 2 ร้านที่อนุญาต
  const shops = await Restaurant.find({
    name: { $in: ["CASA LAPIN", "Kaizen Sushi&Hibachi"] },
    isActive: true,
  }).lean();

  const allowedRestaurantIds = shops.map((x) => x._id);

  // ✅ สร้าง token สำหรับร้านสแกน (ไม่เก็บดิบ)
  const tokenRaw = makeRandomToken(18);
  const tokenHash = sha256(tokenRaw);
  const redeemCipher = encryptCipher(tokenRaw);

  // ✅ upsert กันออกซ้ำ (idempotent): unique index (classId, studentId, dayYMD)
  // หมายเหตุ: ต้องมี index ใน CouponRecord ตามที่เคยให้ไว้
  const publicId = makeRandomToken(12);

  // พยายามสร้าง displayCode ให้ไม่ซ้ำง่ายๆ (best-effort)
  let displayCode = genDisplayCode();

  const existing = await CouponRecord.findOne({
    classId,
    studentId,
    dayYMD,
  }).lean();
  if (existing) {
    return NextResponse.json({ ok: true, publicId: existing.publicId });
  }

  // ถ้ามีโอกาสชน displayCode ค่อย retry แบบเร็วๆ
  for (let i = 0; i < 5; i++) {
    const hit = await CouponRecord.findOne({ displayCode }).lean();
    if (!hit) break;
    displayCode = genDisplayCode();
  }

  const created = await CouponRecord.create({
    publicId,
    redeemCipher,
    redeemTokenHash: tokenHash,

    status: "issued",
    classId,
    studentId,
    dayYMD,

    holderName: stu?.name || stu?.thaiName || stu?.engName || "",
    courseName: cls?.courseName || cls?.title || "",
    roomName: cls?.room || "",

    displayCode,
    couponPrice: 180,
    merchantId: null,
    merchantUserId: null,
    expiresAt,
    allowedRestaurantIds,
  });

  return NextResponse.json({ ok: true, publicId: created.publicId });
}
