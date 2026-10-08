// src/app/api/admin/food-orders/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { resolveFoodDay } from "@/lib/foodReport.server";
import { isYMD } from "@/lib/classDates";
import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";

export const dynamic = "force-dynamic";

export async function GET(req) {
  // C5a: admin console only (Food Report) — kiosk ใช้ /api/food/today ไม่ได้เรียก route นี้
  try {
    await requirePerm(PERM.FOOD_REPORT);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unauthorized" },
      { status: e?.status || 500 },
    );
  }

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date"); // YYYY-MM-DD
  const classId = searchParams.get("classId");
  const q = searchParams.get("q");

  if (!isYMD(dateStr)) {
    return NextResponse.json(
      { ok: false, error: "date is required" },
      { status: 400 },
    );
  }

  // C5b: แถวละ 1 คน/วัน — coupon มาจาก LunchOrder, set/none จาก Student.food
  const { rows, summary, pastDayNote, finalClosed } = await resolveFoodDay({
    dateYMD: dateStr,
    classId,
    q,
  });

  // fields เดิม (คงไว้): couponCount / noFoodCount / menuCounts ("Cash Coupon", "ไม่รับอาหาร" ขึ้นก่อน)
  const t = summary.totals;
  const couponCount = t.couponActive + t.couponPending + t.forfeited + t.couponNoOrder;
  const menuCounts = [
    { label: "Cash Coupon", count: couponCount },
    { label: "ไม่รับอาหาร", count: t.none },
    ...summary.setMenuCounts,
  ];

  return NextResponse.json({
    ok: true,
    items: rows,
    rows,
    total: rows.length,
    pastDayNote,
    finalClosed,
    summary: {
      total: rows.length,
      couponCount,
      noFoodCount: t.none,
      menuCounts,
      ...summary,
    },
  });
}
