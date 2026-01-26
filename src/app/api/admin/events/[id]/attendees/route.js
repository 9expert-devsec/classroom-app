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

export async function GET(req, { params }) {
  try {
    await dbConnect();
    const eventId = String(params?.id || "");

    const ev = await Event.findById(eventId).select("_id").lean();
    if (!ev)
      return NextResponse.json(
        { ok: false, error: "event not found" },
        { status: 404 },
      );

    const { searchParams } = new URL(req.url);
    const q = clean(searchParams.get("q"));
    const status = clean(searchParams.get("status")); // checkedIn | notChecked | cancelled

    const where = { eventId };

    if (status === "cancelled") {
      where.status = "cancelled";
    } else if (status === "checkedIn") {
      where.status = { $ne: "cancelled" };
      where.checkedInAt = { $ne: null };
    } else if (status === "notChecked") {
      where.status = { $ne: "cancelled" };
      where.checkedInAt = null;
    }

    if (q) {
      const rx = new RegExp(escapeRegExp(q), "i");
      where.$or = [{ fullName: rx }, { phone: rx }, { email: rx }];
    }

    const items = await EventAttendee.find(where)
      .sort({ status: 1, checkedInAt: -1, fullName: 1 })
      .lean();

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}

export async function POST(req, { params }) {
  try {
    await dbConnect();
    const eventId = String(params?.id || "");

    const ev = await Event.findById(eventId).select("_id").lean();
    if (!ev)
      return NextResponse.json(
        { ok: false, error: "event not found" },
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

    const doc = await EventAttendee.create({
      eventId,
      fullName,
      phone: clean(body.phone),
      email: clean(body.email),
      sourceChannel: clean(body.sourceChannel),
      gender: clean(body.gender),
      age: Number.isFinite(age) ? age : null,
      workStatus: clean(body.workStatus),
      status: body.status === "cancelled" ? "cancelled" : "registered",
      note: clean(body.note),
    });

    return NextResponse.json({ ok: true, item: doc });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
