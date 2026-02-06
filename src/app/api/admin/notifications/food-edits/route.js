// src/app/api/admin/notifications/food-edits/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireAdmin } from "@/lib/adminAuth.server";
import FoodEditLog from "@/models/FoodEditLog";
import Class from "@/models/Class";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(x) {
  return String(x || "").trim();
}

function formatTimeBKK(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

function choiceLabel(t) {
  const v = clean(t);
  if (v === "coupon") return "Coupon";
  if (v === "noFood") return "ไม่รับอาหาร";
  return "รับอาหาร";
}

export async function GET(req) {
  try {
    await requireAdmin();
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const since = clean(searchParams.get("since"));
    const prime = clean(searchParams.get("prime")) === "1";

    if (prime) {
      const latest = await FoodEditLog.findOne({})
        .sort({ createdAt: -1 })
        .limit(1)
        .lean();

      const cursor = latest?.createdAt
        ? new Date(latest.createdAt).toISOString()
        : new Date().toISOString();

      return NextResponse.json(
        { ok: true, cursor, items: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const sinceDate = since ? new Date(since) : null;
    const hasSince = sinceDate && !Number.isNaN(sinceDate.getTime());

    const q = {};
    if (hasSince) q.createdAt = { $gt: sinceDate };

    const rows = await FoodEditLog.find(q)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // เรียงเก่า -> ใหม่ ให้ toast ตามลำดับ
    const events = rows
      .slice()
      .reverse()
      .map((r) => ({
        id: `${String(r._id)}:${new Date(r.createdAt).toISOString()}`,
        cursor: new Date(r.createdAt).toISOString(),
        classId: clean(r.classId),
        studentName: clean(r.studentName) || "ผู้เรียน",
        studentCompany: clean(r.studentCompany),
        choiceType: clean(r.choiceType),
        doc: r,
      }));

    const classIds = [...new Set(events.map((e) => e.classId).filter(Boolean))];
    const classes = classIds.length
      ? await Class.find({ _id: { $in: classIds } })
          .select("title")
          .lean()
      : [];
    const classMap = new Map(classes.map((c) => [String(c._id), c]));

    const items = events.map((e) => {
      const cl = classMap.get(String(e.classId)) || {};
      const classTitle = clean(cl.title) || "ไม่ระบุคลาส";
      const company = e.studentCompany ? ` (${e.studentCompany})` : "";
      const when = formatTimeBKK(e.cursor);
      const label = choiceLabel(e.choiceType);

      return {
        id: e.id,
        cursor: e.cursor,
        message: `คุณ ${e.studentName}${company} ยืนยันอาหาร: ${label} เวลา ${when} จาก class ${classTitle}`,
      };
    });

    const newCursor = items.length ? items[items.length - 1].cursor : since;

    return NextResponse.json(
      { ok: true, cursor: newCursor, items },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || "ERROR" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
}
