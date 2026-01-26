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

export async function GET(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);

    const q = clean(searchParams.get("q"));
    const eventId = clean(searchParams.get("eventId"));

    if (!eventId) {
      return NextResponse.json(
        { ok: false, error: "missing eventId" },
        { status: 400 },
      );
    }

    const event = await Event.findById(eventId).lean();
    if (!event?._id) {
      return NextResponse.json(
        { ok: false, error: "event not found" },
        { status: 404 },
      );
    }

    if (!q) return NextResponse.json({ ok: true, event, items: [] });

    const rx = new RegExp(escapeRegExp(q), "i");

    const items = await EventAttendee.find({
      eventId: event._id,
      status: { $ne: "cancelled" },
      $or: [{ fullName: rx }, { phone: rx }, { email: rx }],
    })
      .sort({ fullName: 1 })
      .limit(50)
      .lean();

    return NextResponse.json({ ok: true, event, items });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
