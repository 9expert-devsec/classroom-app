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

  // date range (from/to) — ใช้เมื่อไม่ได้ส่ง date มา; date เดี่ยวทำงานเหมือนเดิมทุกอย่าง
  if (!dateStr && (searchParams.has("from") || searchParams.has("to"))) {
    return rangeResponse(searchParams.get("from"), searchParams.get("to"), classId, q);
  }

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

const MAX_RANGE_DAYS = 31;

function ymdList(from, to) {
  const out = [];
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  for (let d = start; d <= end && out.length <= MAX_RANGE_DAYS; d = new Date(d.getTime() + 86400000)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// แต่ละวัน resolve แยกกันด้วย resolveFoodDay ตัวเดิม (ตัวเลขต่อวันเท่ากับเรียกทีละวัน)
// แถวได้ dayYMD + dayFinalClosed เพิ่ม, days[] เก็บค่าต่อวัน (pastDayNote / finalClosed / shops สำหรับใบสั่งร้าน)
async function rangeResponse(from, to, classId, q) {
  if (!isYMD(from) || !isYMD(to) || from > to) {
    return NextResponse.json({ ok: false, error: "from/to is invalid" }, { status: 400 });
  }
  const days = ymdList(from, to);
  if (days.length > MAX_RANGE_DAYS) {
    return NextResponse.json(
      { ok: false, error: `range is limited to ${MAX_RANGE_DAYS} days` },
      { status: 400 },
    );
  }

  const results = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    results.push(
      ...(await Promise.all(
        chunk.map((dateYMD) => resolveFoodDay({ dateYMD, classId, q }).then((r) => ({ dateYMD, ...r }))),
      )),
    );
  }

  const rows = results.flatMap((r) =>
    r.rows.map((row) => ({ ...row, dayYMD: r.dateYMD, dayFinalClosed: r.finalClosed })),
  );

  return NextResponse.json({
    ok: true,
    from,
    to,
    rows,
    total: rows.length,
    days: results.map((r) => ({
      dayYMD: r.dateYMD,
      pastDayNote: r.pastDayNote,
      finalClosed: r.finalClosed,
      total: r.rows.length,
      totals: r.summary.totals,
      shops: r.summary.shops,
    })),
  });
}
