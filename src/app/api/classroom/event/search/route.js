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

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function toDate(x) {
  if (!x) return null;
  const d = new Date(x);
  return isValidDate(d) ? d : null;
}

/**
 * policy: เช็คอินได้เมื่อ now อยู่ในช่วง start..end
 * - ถ้าไม่มี start -> ถือว่าเปิด
 * - ถ้าไม่มี end -> เปิดตั้งแต่ start เป็นต้นไป
 */
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

    const startAt = event.startAt || event.startDate || null;
    const endAt = event.endAt || event.endDate || null;

    const canCheckin = !!event.isActive && nowInRange(startAt, endAt);

    // ✅ ถ้าไม่พิมพ์ค้นหา: คืน event info + canCheckin
    if (!q) {
      return NextResponse.json({ ok: true, event, canCheckin, items: [] });
    }

    // ✅ (policy) ยัง “ค้นหาได้” แม้ event ปิด แต่ UI ควร disable ปุ่มเช็คอินจาก canCheckin
    // ถ้าอยาก "ปิดค้นหาเลย" ให้เปลี่ยนเป็น return 403 ตอน canCheckin=false ได้

    const rx = new RegExp(escapeRegExp(q), "i");

    const items = await EventAttendee.find({
      eventId: event._id,
      status: { $ne: "cancelled" },
      $or: [{ fullName: rx }, { phone: rx }, { email: rx }],
    })
      .sort({ fullName: 1 })
      .limit(50)
      .lean();

    return NextResponse.json({ ok: true, event, canCheckin, items });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
