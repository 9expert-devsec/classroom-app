import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Event from "@/models/Event";
import EventAttendee from "@/models/EventAttendee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(s) {
  return String(s || "").trim();
}
function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * policy: แสดงเฉพาะ event ที่ “ยังไม่จบ”
 * รองรับทั้ง endAt และ endDate (กัน field name ไม่ตรง)
 */
function buildNotEndedQuery(now = new Date()) {
  return {
    $or: [
      { endAt: { $gte: now } },
      { endDate: { $gte: now } },

      // ไม่มี endAt/endDate -> ถือว่ายังไม่จบ
      { endAt: { $exists: false } },
      { endDate: { $exists: false } },
      { endAt: null },
      { endDate: null },
    ],
  };
}

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const q = clean(searchParams.get("q"));
    const onlyMine = clean(searchParams.get("onlyMine")); // "1" -> ต้อง match attendee เท่านั้น

    const now = new Date();

    const eventBaseFilter = {
      isActive: true,
      ...buildNotEndedQuery(now),
    };

    // ถ้ามี q: หาว่า user อยู่ event ไหนบ้าง (จาก attendee)
    if (q) {
      const rx = new RegExp(escapeRegExp(q), "i");

      const eventIds = await EventAttendee.distinct("eventId", {
        status: { $ne: "cancelled" },
        $or: [{ fullName: rx }, { phone: rx }, { email: rx }],
      });

      const ids = (eventIds || []).map((x) => String(x || "")).filter(Boolean);
      if (!ids.length) return NextResponse.json({ ok: true, items: [] });

      const items = await Event.find({
        ...eventBaseFilter,
        _id: { $in: ids },
      })
        .sort({ startAt: 1, startDate: 1, createdAt: -1 })
        .limit(50)
        .lean();

      return NextResponse.json({ ok: true, items });
    }

    // ถ้า onlyMine=1 แต่ไม่มี q -> ไม่รู้ว่า mine คือใคร
    if (onlyMine === "1") {
      return NextResponse.json({ ok: true, items: [] });
    }

    // default: event active ที่ยังไม่จบ
    const items = await Event.find(eventBaseFilter)
      .sort({ startAt: 1, startDate: 1, createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
