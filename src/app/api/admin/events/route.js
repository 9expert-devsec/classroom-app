import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Event from "@/models/Event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(s) {
  return String(s || "").trim();
}

export async function GET() {
  try {
    await dbConnect();
    const items = await Event.find({}).sort({ startAt: -1 }).limit(200).lean();
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const body = await req.json().catch(() => ({}));

    const title = clean(body.title);
    const location = clean(body.location);
    const note = clean(body.note);

    const startAt = body.startAt ? new Date(body.startAt) : null;
    const endAt = body.endAt ? new Date(body.endAt) : null;

    if (!title)
      return NextResponse.json(
        { ok: false, error: "missing title" },
        { status: 400 },
      );
    if (!startAt || Number.isNaN(startAt.getTime())) {
      return NextResponse.json(
        { ok: false, error: "invalid startAt" },
        { status: 400 },
      );
    }

    const doc = await Event.create({
      title,
      location,
      note,
      startAt,
      endAt: endAt && !Number.isNaN(endAt.getTime()) ? endAt : null,
      isActive: body.isActive !== false,
      coverImageUrl: clean(body.coverImageUrl),
      coverImagePublicId: clean(body.coverImagePublicId),
    });

    return NextResponse.json({ ok: true, item: doc });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
