// src/app/api/admin/coupons/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireAdmin } from "@/lib/adminAuth.server";

import CouponRecord from "@/models/CouponRecord";
import Restaurant from "@/models/Restaurant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(x) {
  return String(x ?? "").trim();
}

function toInt(x, d = 1) {
  const n = Number(x);
  if (!Number.isFinite(n)) return d;
  return Math.max(1, Math.floor(n));
}

function toLimit(x, d = 30) {
  const n = Number(x);
  if (!Number.isFinite(n)) return d;
  return Math.max(1, Math.min(2000, Math.floor(n)));
}

export async function GET(req) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  await dbConnect();

  const { searchParams } = new URL(req.url);

  const q = clean(searchParams.get("q"));
  const day = clean(searchParams.get("day")); // YYYY-MM-DD
  const status = clean(searchParams.get("status"));
  const merchantId = clean(searchParams.get("merchantId"));

  const page = toInt(searchParams.get("page") || 1, 1);
  const limit = toLimit(searchParams.get("limit") || 30, 30);
  const skip = (page - 1) * limit;

  const where = {};

  if (day) where.dayYMD = day;
  if (status && status !== "all") where.status = status;

  if (
    merchantId &&
    merchantId !== "all" &&
    /^[a-f0-9]{24}$/i.test(merchantId)
  ) {
    where.merchantId = merchantId;
  }

  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    where.$or = [
      { displayCode: rx },
      { billCode: rx },
      { holderName: rx },
      { courseName: rx },
      { roomName: rx },
      { publicId: rx }, // ✅ เผื่อแอดมินค้นจากลิงก์
    ];
  }

  const [total, rows] = await Promise.all([
    CouponRecord.countDocuments(where),
    CouponRecord.find(where)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        // ✅ เพิ่ม publicId เพื่อทำลิงก์ /coupon/<publicId>
        "publicId displayCode holderName courseName roomName dayYMD status couponPrice spentAmount diffAmount redeemedAt merchantId createdAt billCode billDayYMD billTotal billCouponTotal billPayMore billCouponCount",
      )
      .lean(),
  ]);

  const merchantIds = Array.from(
    new Set(
      rows
        .map((x) => (x.merchantId ? String(x.merchantId) : ""))
        .filter(Boolean),
    ),
  );

  const merchants = merchantIds.length
    ? await Restaurant.find({ _id: { $in: merchantIds } })
        .select("name")
        .lean()
    : [];

  const merchantMap = new Map(merchants.map((m) => [String(m._id), m.name]));

  const merchantOptions = await Restaurant.find({ isActive: true })
    .select("name")
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({
    ok: true,
    total,
    page,
    limit,
    items: rows.map((x) => ({
      id: String(x._id),
      publicId: x.publicId || "", // ✅ สำคัญ: เอาไปทำ QR/Copy link
      displayCode: x.displayCode || "",
      holderName: x.holderName || "",
      courseName: x.courseName || "",
      roomName: x.roomName || "",
      dayYMD: x.dayYMD || "",
      status: x.status || "",
      couponPrice: x.couponPrice ?? 180,
      spentAmount: x.spentAmount ?? 0,
      diffAmount: x.diffAmount ?? 0,
      redeemedAt: x.redeemedAt || null,
      merchantId: x.merchantId ? String(x.merchantId) : "",
      merchantName: x.merchantId
        ? merchantMap.get(String(x.merchantId)) || ""
        : "",
      createdAt: x.createdAt || null,
    })),
    merchants: merchantOptions.map((m) => ({
      id: String(m._id),
      name: m.name || "-",
    })),
  });
}
