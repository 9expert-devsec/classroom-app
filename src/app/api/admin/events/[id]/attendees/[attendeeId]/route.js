import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import EventAttendee from "@/models/EventAttendee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(s) {
  return String(s || "").trim();
}

export async function PUT(req, { params }) {
  try {
    await dbConnect();
    const eventId = String(params?.id || "");
    const attendeeId = String(params?.attendeeId || "");

    const doc = await EventAttendee.findOne({ _id: attendeeId, eventId });
    if (!doc)
      return NextResponse.json(
        { ok: false, error: "not found" },
        { status: 404 },
      );

    const body = await req.json().catch(() => ({}));

    const fullName = clean(body.fullName);
    if (!fullName)
      return NextResponse.json(
        { ok: false, error: "missing fullName" },
        { status: 400 },
      );

    const age = body.age == null || body.age === "" ? null : Number(body.age);

    doc.fullName = fullName;
    doc.phone = clean(body.phone);
    doc.email = clean(body.email);
    doc.sourceChannel = clean(body.sourceChannel);
    doc.gender = clean(body.gender);
    doc.age = Number.isFinite(age) ? age : null;
    doc.workStatus = clean(body.workStatus);
    doc.status = body.status === "cancelled" ? "cancelled" : "registered";
    doc.note = clean(body.note);

    await doc.save();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}

export async function DELETE(_req, { params }) {
  try {
    await dbConnect();
    const eventId = String(params?.id || "");
    const attendeeId = String(params?.attendeeId || "");

    await EventAttendee.deleteOne({ _id: attendeeId, eventId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
