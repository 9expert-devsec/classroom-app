// src/app/api/admin/event/[id]/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Event from "@/models/Event";
import { v2 as cloudinary } from "cloudinary";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

async function destroyIfExists(publicId) {
  const pid = clean(publicId);
  if (!pid) return;
  try {
    await cloudinary.uploader.destroy(pid, { resource_type: "image" });
  } catch {
    // ignore
  }
}

export async function GET(_req, { params }) {
  try {
    await requirePerm(PERM.EVENTS_READ);
    await dbConnect();

    const p = await Promise.resolve(params);
    const id = String(p?.id || "");

    const item = await Event.findById(id).lean();
    if (!item) return jsonError("not found", 404);

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return jsonError(String(e?.message || e), e?.status || 500);
  }
}

export async function PUT(req, { params }) {
  try {
    // ✅ OPS = View Only, SA/EVT = Edit/Delete
    const adminCtx = await requirePerm(PERM.EVENTS_SETTINGS_WRITE);
    await dbConnect();

    const p = await Promise.resolve(params);
    const id = String(p?.id || "");

    const body = await req.json().catch(() => ({}));

    const doc = await Event.findById(id);
    if (!doc) return jsonError("not found", 404);

    const before = pickEventSnapshot(doc);

    const title = clean(body.title);
    if (!title) return jsonError("missing title", 400);

    const startAt = body.startAt ? new Date(body.startAt) : null;
    const endAt = body.endAt ? new Date(body.endAt) : null;

    if (!startAt || Number.isNaN(startAt.getTime())) {
      return jsonError("invalid startAt", 400);
    }

    // cover image replace/remove
    const newCoverUrl = clean(body.coverImageUrl);
    const newCoverPid = clean(body.coverImagePublicId);

    const prevPid = clean(body.prevCoverImagePublicId);

    const coverChanged = prevPid !== newCoverPid;
    const coverRemoved = !!prevPid && !newCoverPid;

    // ถ้าส่ง prevCoverPublicId มา และ publicId ใหม่ต่าง/ว่าง → ลบของเก่า
    if (prevPid && prevPid !== newCoverPid) {
      await destroyIfExists(prevPid);
    }

    doc.title = title;
    doc.location = clean(body.location);
    doc.note = clean(body.note);
    doc.startAt = startAt;
    doc.endAt = endAt && !Number.isNaN(endAt.getTime()) ? endAt : null;
    doc.isActive = body.isActive !== false;

    doc.coverImageUrl = newCoverUrl;
    doc.coverImagePublicId = newCoverPid;

    await doc.save();

    const after = pickEventSnapshot(doc);

    await safeAudit({
      ctx: adminCtx,
      req,
      action: "update",
      entityType: "event",
      entityId: String(doc._id),
      entityLabel: clean(doc.title) || String(doc._id),
      before,
      after,
      meta: {
        coverChanged,
        coverRemoved,
        prevCoverImagePublicId: prevPid || undefined,
        newCoverImagePublicId: newCoverPid || undefined,
      },
      // snapshot เราไม่ได้ใส่ sensitive อยู่แล้ว
      ignorePaths: [],
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(String(e?.message || e), e?.status || 500);
  }
}

export async function DELETE(req, { params }) {
  try {
    const adminCtx = await requirePerm(PERM.EVENTS_SETTINGS_DELETE);
    await dbConnect();

    const p = await Promise.resolve(params);
    const id = String(p?.id || "");

    const doc = await Event.findById(id);
    if (!doc) return NextResponse.json({ ok: true });

    const before = pickEventSnapshot(doc);

    // ลบรูป cover ด้วย
    if (doc.coverImagePublicId) await destroyIfExists(doc.coverImagePublicId);

    await doc.deleteOne();

    await safeAudit({
      ctx: adminCtx,
      req,
      action: "delete",
      entityType: "event",
      entityId: String(id),
      entityLabel: clean(before?.title) || String(id),
      before,
      after: null,
      meta: { deleted: true },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(String(e?.message || e), e?.status || 500);
  }
}
