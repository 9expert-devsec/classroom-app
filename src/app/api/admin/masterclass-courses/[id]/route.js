// src/app/api/admin/masterclass-courses/[id]/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import MasterclassCourse from "@/models/MasterclassCourse";
import Class from "@/models/Class";
import { requireAdmin } from "@/lib/adminAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(s) {
  return String(s ?? "").trim();
}

function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

async function paramId(params) {
  const p = await Promise.resolve(params);
  return String(p?.id || "");
}

/* ---------------- GET: one ---------------- */

export async function GET(_req, { params }) {
  try {
    await requireAdmin();
    await dbConnect();

    const id = await paramId(params);
    const item = await MasterclassCourse.findById(id).lean();
    if (!item) return jsonError("not found", 404);

    const classCount = await Class.countDocuments({
      masterclassCourseId: id,
    });

    return NextResponse.json({ ok: true, item: { ...item, classCount } });
  } catch (e) {
    return jsonError(String(e?.message || e), e?.status || 500);
  }
}

/* ---------------- PATCH: update ---------------- */

export async function PATCH(req, { params }) {
  try {
    await requireAdmin();
    await dbConnect();

    const id = await paramId(params);
    const doc = await MasterclassCourse.findById(id);
    if (!doc) return jsonError("not found", 404);

    const body = await req.json().catch(() => ({}));

    // courseId ห้ามแก้: ชื่อ class ที่สร้างไปแล้ว embed ค่านี้อยู่
    if (body?.courseId !== undefined) {
      const incoming = clean(body.courseId).toUpperCase();
      if (incoming && incoming !== clean(doc.courseId).toUpperCase()) {
        return jsonError(
          "course_id_immutable (แก้ Course ID หลังสร้างแล้วไม่ได้)",
          400,
        );
      }
    }

    if (body?.name !== undefined) {
      const name = clean(body.name);
      if (!name) return jsonError("missing name", 400);
      doc.name = name;
    }

    if (body?.coverImageUrl !== undefined) {
      doc.coverImageUrl = clean(body.coverImageUrl);
    }

    if (body?.coverImagePublicId !== undefined) {
      doc.coverImagePublicId = clean(body.coverImagePublicId);
    }

    if (body?.isActive !== undefined) {
      doc.isActive = !!body.isActive;
    }

    await doc.save();

    return NextResponse.json({ ok: true, item: doc });
  } catch (e) {
    return jsonError(String(e?.message || e), e?.status || 500);
  }
}

/* ---------------- DELETE ---------------- */

export async function DELETE(_req, { params }) {
  try {
    await requireAdmin();
    await dbConnect();

    const id = await paramId(params);
    const doc = await MasterclassCourse.findById(id);
    if (!doc) return jsonError("not found", 404);

    const classCount = await Class.countDocuments({
      masterclassCourseId: id,
    });

    if (classCount > 0) {
      return jsonError("course_in_use", 409, { classCount });
    }

    await doc.deleteOne();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(String(e?.message || e), e?.status || 500);
  }
}
