// src/app/api/admin/food/days/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import FoodDaySet from "@/models/FoodDaySet";
import FoodSet from "@/models/FoodSet";

export const dynamic = "force-dynamic";

function normalizeDay(dateInput) {
  const d = new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d;
}

// GET /api/admin/food/days?month=2025-12
export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // "YYYY-MM"

  const filter = {};

  if (month) {
    const [y, m] = month.split("-").map(Number);
    if (Number.isFinite(y) && Number.isFinite(m)) {
      const from = new Date(y, m - 1, 1);
      const to = new Date(y, m, 1);
      filter.date = { $gte: from, $lt: to };
    }
  }

  const docs = await FoodDaySet.find(filter)
    .sort({ date: 1 })
    .populate("entries.restaurant", "name logoUrl couponEnabled")
    .populate("entries.set", "name")
    .lean();

  // แปลงให้อยู่ในรูป { date, items: [{ restaurant, set, mode }] }
  const items = docs.map((doc) => ({
    _id: doc._id,
    date: doc.date,
    items: (doc.entries || []).map((en) => ({
      restaurant: en.restaurant, // อาจเป็น object (จาก populate) หรือ ObjectId
      set: en.set || null,
      mode: en.mode === "coupon" ? "coupon" : "set",
    })),
  }));

  return NextResponse.json({ ok: true, items });
}

// POST /api/admin/food/days
export async function POST(req) {
  await dbConnect();
  const body = await req.json();
  const { date, items } = body; // items มาจากหน้า Calendar

  if (!date) {
    return NextResponse.json(
      { ok: false, error: "date is required" },
      { status: 400 }
    );
  }

  const day = normalizeDay(date);

  // แปลง items -> entries สำหรับเก็บใน DB
  let entries = [];
  if (Array.isArray(items)) {
    entries = items
      .filter((it) => it && it.restaurantId)
      .map((it) => {
        const mode = it.mode === "coupon" ? "coupon" : "set";
        return {
          restaurant: it.restaurantId,
          // coupon ไม่มี set — บังคับ null กันข้อมูลค้าง
          set: mode === "coupon" ? null : it.setId || null,
          mode,
        };
      });
  }

  const doc = await FoodDaySet.findOneAndUpdate(
    { date: day },
    {
      $set: {
        date: day,
        entries,
      },
    },
    { upsert: true, new: true }
  );

  return NextResponse.json({ ok: true, item: doc });
}
