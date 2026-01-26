import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Event from "@/models/Event";
import EventAttendee from "@/models/EventAttendee";

export const dynamic = "force-dynamic";

function clean(s) {
  return String(s || "").trim();
}
function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// (ง่าย ๆ) คืน active เรียงใกล้วันนี้ก่อน
export async function GET(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);

    const q = clean(searchParams.get("q"));
    const onlyMine = clean(searchParams.get("onlyMine")); // "1" -> ต้อง match attendee เท่านั้น

    // ถ้าผู้ใช้กรอกค้นหา: หาว่าเขาอยู่ event ไหนบ้าง
    if (q) {
      const rx = new RegExp(escapeRegExp(q), "i");
      const attendeeRows = await EventAttendee.find({
        status: { $ne: "cancelled" },
        $or: [{ fullName: rx }, { phone: rx }, { email: rx }],
      })
        .select("eventId")
        .lean();

      const eventIds = [...new Set(attendeeRows.map((r) => String(r.eventId)))];
      if (!eventIds.length) {
        return NextResponse.json({ ok: true, items: [] });
      }

      const items = await Event.find({
        _id: { $in: eventIds },
        isActive: true,
      })
        .sort({ startAt: 1 })
        .lean();

      return NextResponse.json({ ok: true, items });
    }

    // ถ้า onlyMine=1 แต่ไม่ส่ง q -> ไม่รู้ว่า "mine" คือใคร จึงคืนว่าง
    if (onlyMine === "1") {
      return NextResponse.json({ ok: true, items: [] });
    }

    // default: คืน event active ทั้งหมด (เรียงตามวัน)
    const items = await Event.find({ isActive: true })
      .sort({ startAt: 1 })
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
