import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Event from "@/models/Event";
import EventAttendee from "@/models/EventAttendee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(s) {
  return String(s || "").trim();
}

function countBy(arr, keyFn, emptyLabel = "ไม่ระบุ") {
  const map = new Map();
  for (const x of arr) {
    const kRaw = clean(keyFn(x));
    const k = kRaw || emptyLabel;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function ageBucket(age) {
  const n = Number(age);
  if (!Number.isFinite(n)) return "ไม่ระบุ";
  if (n < 18) return "<18";
  if (n <= 24) return "18-24";
  if (n <= 34) return "25-34";
  if (n <= 44) return "35-44";
  if (n <= 54) return "45-54";
  return "55+";
}

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const eventId = clean(searchParams.get("eventId"));
    if (!eventId) {
      return NextResponse.json(
        { ok: false, error: "missing eventId" },
        { status: 400 },
      );
    }

    const ev = await Event.findById(eventId)
      .select("title location startAt endAt coverImageUrl isActive")
      .lean();

    if (!ev) {
      return NextResponse.json(
        { ok: false, error: "event not found" },
        { status: 404 },
      );
    }

    const items = await EventAttendee.find({ eventId })
      .select(
        "_id fullName phone email sourceChannel gender age workStatus status checkedInAt signatureUrl",
      )
      .sort({ fullName: 1 })
      .lean();

    const total = items.length;
    const checkedIn = items.filter((x) => !!x.checkedInAt).length;
    const notCheckedIn = total - checkedIn;

    const breakdowns = {
      sourceChannel: countBy(items, (x) => x.sourceChannel, "ไม่ระบุ"),
      gender: countBy(items, (x) => x.gender, "ไม่ระบุ"),
      workStatus: countBy(items, (x) => x.workStatus, "ไม่ระบุ"),
      ageBucket: countBy(items, (x) => ageBucket(x.age), "ไม่ระบุ"),
    };

    return NextResponse.json({
      ok: true,
      event: ev,
      totals: { total, checkedIn, notCheckedIn },
      breakdowns,
      items,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
