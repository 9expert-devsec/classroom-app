import dbConnect from "@/lib/dbConnect";
import Class from "@/models/Class";
import Student from "@/models/Student";
import { requireAdmin } from "@/lib/adminAuth.server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ================= helpers ================= */

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function clean(s) {
  return String(s ?? "").trim();
}

const ALLOWED_RECEIVE_TYPES = new Set(["ems", "on_class"]);
const ALLOWED_STUDENT_STATUS = new Set(["active", "cancelled", "postponed"]);

/* ================= PATCH: edit student ================= */

export async function PATCH(req, { params }) {
  try {
    await requireAdmin();
    await dbConnect();

    const classId = params?.id;
    const studentId = params?.studentId;

    if (!classId || !studentId) {
      return jsonError("missing classId or studentId");
    }

    const body = await req.json().catch(() => ({}));

    // ตรวจว่ามี class จริง
    const klass = await Class.findById(classId).lean();
    if (!klass) {
      return jsonError("class not found", 404);
    }

    // โหลด student + validate classId
    const student = await Student.findOne({
      _id: studentId,
      classId,
    });

    if (!student) {
      return jsonError("student not found in this class", 404);
    }

    /* ===== fields ที่อนุญาตให้แก้ ===== */

    if ("name" in body) student.name = clean(body.name);
    if ("thaiName" in body) student.thaiName = clean(body.thaiName);
    if ("engName" in body) student.engName = clean(body.engName);

    // เผื่อ UI ส่ง nameEN มา (ของคุณใน StudentsTable)
    if ("nameEN" in body) student.engName = clean(body.nameEN);

    if ("company" in body) student.company = clean(body.company);
    if ("paymentRef" in body) student.paymentRef = clean(body.paymentRef);

    if ("documentReceiveType" in body) {
      const t = clean(body.documentReceiveType);
      if (ALLOWED_RECEIVE_TYPES.has(t)) {
        student.documentReceiveType = t;
      }
    }

    // ✅ เพิ่ม: อัปเดตสถานะผู้เรียน
    if ("studentStatus" in body) {
      const st = clean(body.studentStatus);
      if (ALLOWED_STUDENT_STATUS.has(st)) {
        student.studentStatus = st;
      }
    }

    // เผื่อแก้สถานะ late แบบ manual
    if ("isLate" in body) {
      student.isLate = Boolean(body.isLate);
    }

    await student.save();

    return NextResponse.json({
      ok: true,
      student: student.toObject(),
    });
  } catch (err) {
    console.error("PATCH student error:", err);
    return jsonError("internal server error", 500);
  }
}

/* ================= DELETE: remove student ================= */

export async function DELETE(req, { params }) {
  try {
    await requireAdmin();
    await dbConnect();

    const classId = params?.id;
    const studentId = params?.studentId;

    if (!classId || !studentId) {
      return jsonError("missing classId or studentId");
    }

    // ตรวจว่ามี class จริง
    const klass = await Class.findById(classId).lean();
    if (!klass) {
      return jsonError("class not found", 404);
    }

    // ลบเฉพาะ student ที่อยู่ใน class นี้
    const result = await Student.findOneAndDelete({
      _id: studentId,
      classId,
    });

    if (!result) {
      return jsonError("student not found in this class", 404);
    }

    return NextResponse.json({
      ok: true,
      deletedStudentId: studentId,
    });
  } catch (err) {
    console.error("DELETE student error:", err);
    return jsonError("internal server error", 500);
  }
}
