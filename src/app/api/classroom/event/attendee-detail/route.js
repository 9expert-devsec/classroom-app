import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Event from "@/models/Event";
import EventAttendee from "@/models/EventAttendee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(s) {
  return String(s || "").trim();
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function toDate(x) {
  if (!x) return null;
  const d = new Date(x);
  return isValidDate(d) ? d : null;
}

function nowInRange(startAt, endAt) {
  const now = new Date();
  const s = toDate(startAt);
  const e = toDate(endAt);

  if (!s) return true;
  if (!e) return now.getTime() >= s.getTime();

  const t = now.getTime();
  return t >= s.getTime() && t <= e.getTime();
}

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const eventId = clean(searchParams.get("eventId"));
    const attendeeId = clean(searchParams.get("attendeeId"));

    if (!eventId) {
      return NextResponse.json(
        { ok: false, error: "missing eventId" },
        { status: 400 },
      );
    }

    if (!attendeeId) {
      return NextResponse.json(
        { ok: false, error: "missing attendeeId" },
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

    const item = await EventAttendee.findOne({
      _id: attendeeId,
      eventId: event._id,
      status: { $ne: "cancelled" },
    }).lean();

    if (!item?._id) {
      return NextResponse.json(
        { ok: false, error: "attendee not found" },
        { status: 404 },
      );
    }

    const startAt = event.startAt || event.startDate || null;
    const endAt = event.endAt || event.endDate || null;
    const canCheckin = !!event.isActive && nowInRange(startAt, endAt);

    return NextResponse.json({
      ok: true,
      event,
      canCheckin,
      item,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}