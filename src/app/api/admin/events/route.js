import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Event from "@/models/Event";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(s) {
  return String(s || "").trim();
}

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function pickEventSnapshot(ev) {
  if (!ev) return null;
  return {
    id: String(ev._id || ""),
    title: clean(ev.title),
    location: clean(ev.location),
    note: clean(ev.note),

    startAt: ev.startAt ? new Date(ev.startAt).toISOString() : "",
    endAt: ev.endAt ? new Date(ev.endAt).toISOString() : "",

    isActive: ev.isActive !== false,

    coverImageUrl: clean(ev.coverImageUrl),
    coverImagePublicId: clean(ev.coverImagePublicId),

    createdAt: ev.createdAt ? new Date(ev.createdAt).toISOString() : "",
    updatedAt: ev.updatedAt ? new Date(ev.updatedAt).toISOString() : "",
  };
}

async function safeAudit(payload) {
  try {
    await writeAuditLog(payload);
  } catch (e) {
    console.warn("[audit] writeAuditLog failed:", e?.message || e);
  }
}

export async function GET() {
  try {
    await requirePerm(PERM.EVENTS_READ);
    await dbConnect();

    const items = await Event.find({}).sort({ startAt: -1 }).limit(200).lean();
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return jsonError(String(e?.message || e), e?.status || 500);
  }
}

export async function POST(req) {
  try {
    const adminCtx = await requirePerm(PERM.EVENTS_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));

    const title = clean(body.title);
    const location = clean(body.location);
    const note = clean(body.note);

    const startAt = body.startAt ? new Date(body.startAt) : null;
    const endAt = body.endAt ? new Date(body.endAt) : null;

    if (!title) return jsonError("missing title", 400);
    if (!startAt || Number.isNaN(startAt.getTime())) {
      return jsonError("invalid startAt", 400);
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

    // ✅ Audit: create event
    await safeAudit({
      ctx: adminCtx,
      req,
      action: "create",
      entityType: "event",
      entityId: String(doc._id),
      entityLabel: clean(doc.title) || String(doc._id),
      before: null,
      after: pickEventSnapshot(doc),
      meta: { created: true },
    });

    return NextResponse.json({ ok: true, item: doc });
  } catch (e) {
    return jsonError(String(e?.message || e), e?.status || 500);
  }
}
