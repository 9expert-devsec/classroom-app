import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Event from "@/models/Event";
import EventAttendee from "@/models/EventAttendee";
import { uploadSignatureDataUrl } from "@/lib/cloudinaryUpload.server";

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

export async function POST(req) {
  try {
    await dbConnect();

    const body = await req.json().catch(() => ({}));

    const eventIdFromBody = clean(body.eventId); // optional
    const attendeeId = clean(body.attendeeId);
    const signatureDataUrl = clean(body.signatureDataUrl);

    if (!attendeeId) {
      return NextResponse.json(
        { ok: false, error: "missing attendeeId" },
        { status: 400 },
      );
    }
    if (!signatureDataUrl) {
      return NextResponse.json(
        { ok: false, error: "missing signatureDataUrl" },
        { status: 400 },
      );
    }

    // 1) หา attendee
    let attendee = null;

    if (eventIdFromBody) {
      attendee = await EventAttendee.findOne({
        _id: attendeeId,
        eventId: eventIdFromBody,
      });
    } else {
      attendee = await EventAttendee.findById(attendeeId);
    }

    if (!attendee) {
      return NextResponse.json(
        { ok: false, error: "attendee not found" },
        { status: 404 },
      );
    }

    const eventId = String(attendee.eventId || eventIdFromBody || "");
    if (!eventId) {
      return NextResponse.json(
        { ok: false, error: "missing eventId" },
        { status: 400 },
      );
    }

    if (String(attendee.eventId) !== String(eventId)) {
      return NextResponse.json(
        { ok: false, error: "event mismatch" },
        { status: 400 },
      );
    }

    if (attendee.status === "cancelled") {
      return NextResponse.json(
        { ok: false, error: "attendee cancelled" },
        { status: 400 },
      );
    }

    // 2) เช็คเวลา event + isActive
    const event = await Event.findById(eventId).lean();
    if (!event?._id) {
      return NextResponse.json(
        { ok: false, error: "event not found" },
        { status: 404 },
      );
    }

    if (!event.isActive) {
      return NextResponse.json(
        { ok: false, error: "event inactive" },
        { status: 403 },
      );
    }

    const startAt = event.startAt || event.startDate || null;
    const endAt = event.endAt || event.endDate || null;

    if (!nowInRange(startAt, endAt)) {
      return NextResponse.json(
        { ok: false, error: "event closed" },
        { status: 403 },
      );
    }

    // 3) upload signature
    const up = await uploadSignatureDataUrl(signatureDataUrl, {
      folder: "classroom/event-signatures",
      publicId: attendee.signaturePublicId || "", // overwrite ถ้ามีของเดิม
    });

    // 4) update attendee
    attendee.checkedInAt = new Date();
    attendee.signatureUrl = up.url;
    attendee.signaturePublicId = up.publicId;

    await attendee.save();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
