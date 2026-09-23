// src/app/api/admin/masterclass-courses/route.js
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

/**
 * courseId ไปอยู่ในชื่อ class และ URL → บังคับให้สะอาด
 * uppercase A-Z, 0-9 และ "-" เท่านั้น ความยาว 2-40
 */
function normalizeCourseId(raw) {
  return clean(raw).toUpperCase();
}

const COURSE_ID_RE = /^[A-Z0-9-]{2,40}$/;

function validateCourseId(raw) {
  const courseId = normalizeCourseId(raw);
  if (!courseId) return { ok: false, error: "missing courseId" };
  if (!COURSE_ID_RE.test(courseId)) {
    return {
      ok: false,
      error:
        "invalid courseId (ใช้ได้เฉพาะ A-Z, 0-9 และ - ความยาว 2-40 ตัวอักษร)",
    };
  }
  return { ok: true, courseId };
}

/* ---------------- GET: list ---------------- */

export async function GET(req) {
  try {
    await requireAdmin();
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("activeOnly");

    const find = {};
    if (activeOnly === "1" || activeOnly === "true") {
      find.isActive = true;
    }

    const items = await MasterclassCourse.find(find)
      .sort({ courseId: 1 })
      .lean();

    // จำนวน class ที่ผูกกับแต่ละคอร์ส (ใช้ในตารางฝั่ง admin + กันลบ)
    const counts = await Class.aggregate([
      { $match: { masterclassCourseId: { $ne: null } } },
      { $group: { _id: "$masterclassCourseId", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

    return NextResponse.json({
      ok: true,
      items: items.map((c) => ({
        ...c,
        classCount: countMap.get(String(c._id)) || 0,
      })),
    });
  } catch (e) {
    return jsonError(String(e?.message || e), e?.status || 500);
  }
}

/* ---------------- POST: create ---------------- */

export async function POST(req) {
  try {
    await requireAdmin();
    await dbConnect();

    const body = await req.json().catch(() => ({}));

    const check = validateCourseId(body?.courseId);
    if (!check.ok) return jsonError(check.error, 400);

    const name = clean(body?.name);
    if (!name) return jsonError("missing name", 400);

    try {
      const doc = await MasterclassCourse.create({
        courseId: check.courseId,
        name,
        coverImageUrl: clean(body?.coverImageUrl),
        coverImagePublicId: clean(body?.coverImagePublicId),
        isActive: body?.isActive !== false,
      });

      return NextResponse.json({ ok: true, item: doc });
    } catch (err) {
      if (err?.code === 11000) {
        return jsonError("duplicate_course_id", 409);
      }
      throw err;
    }
  } catch (e) {
    return jsonError(String(e?.message || e), e?.status || 500);
  }
}
