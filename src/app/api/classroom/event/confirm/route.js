import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import EventAttendee from "@/models/EventAttendee";
import { uploadSignatureDataUrl } from "@/lib/cloudinaryUpload.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(s) {
  return String(s || "").trim();
}


export async function POST(req) {
  try {
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const eventId = clean(body.eventId);
    const attendeeId = clean(body.attendeeId);
    const signatureDataUrl = clean(body.signatureDataUrl);

    if (!eventId) {
      return NextResponse.json({ ok: false, error: "missing eventId" }, { status: 400 });
    }
    if (!attendeeId) {
      return NextResponse.json({ ok: false, error: "missing attendeeId" }, { status: 400 });
    }
    if (!signatureDataUrl) {
      return NextResponse.json({ ok: false, error: "missing signatureDataUrl" }, { status: 400 });
    }

    const attendee = await EventAttendee.findOne({ _id: attendeeId, eventId });
    if (!attendee) {
      return NextResponse.json({ ok: false, error: "attendee not found" }, { status: 404 });
    }
    if (attendee.status === "cancelled") {
      return NextResponse.json({ ok: false, error: "attendee cancelled" }, { status: 400 });
    }

    const up = await uploadSignatureDataUrl(signatureDataUrl, {
      folder: "classroom/event-signatures",
      publicId: attendee.signaturePublicId || "", // ถ้ามีจะ overwrite รูปเดิม
    });

    attendee.checkedInAt = new Date();
    attendee.signatureUrl = up.url;
    attendee.signaturePublicId = up.publicId;

    await attendee.save();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
