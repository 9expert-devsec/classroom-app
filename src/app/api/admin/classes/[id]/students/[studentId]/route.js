import dbConnect from "@/lib/dbConnect";
import Class from "@/models/Class";
import Student from "@/models/Student";
import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
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

function getStudentDisplayName(stu) {
  return (
    clean(stu?.name) ||
    clean(stu?.thaiName) ||
    clean(stu?.engName) ||
    clean(stu?.nameEN) ||
    "-"
  );
}

// snapshot เล็ก ๆ สำหรับ audit (กันบวม + กันข้อมูลลับ)
function pickStudentSnapshot(stu) {
  if (!stu) return null;
  const tline = Array.isArray(stu.typeTimeline) ? stu.typeTimeline : [];
  const lastTL = tline.length ? tline[tline.length - 1] : null;

  return {
    id: String(stu._id || ""),
    classId: String(stu.classId || ""),
    name: clean(stu.name),
    thaiName: clean(stu.thaiName),
    engName: clean(stu.engName),
    company: clean(stu.company),
    paymentRef: clean(stu.paymentRef),

    studentStatus: clean(stu.studentStatus),
    documentReceiveType: clean(stu.documentReceiveType),

    isLate: !!stu.isLate,

    type: clean(stu.type || stu.learnType || ""),
    typeEditCount: Number(stu.typeEditCount || 0),

    typeTimelineLen: tline.length,
    typeTimelineLast: lastTL
      ? {
          effectiveDay: Number(lastTL.effectiveDay || 0),
          type: clean(lastTL.type),
          at: lastTL.at ? new Date(lastTL.at).toISOString() : "",
          by: clean(lastTL.by),
          note: clean(lastTL.note),
        }
      : null,
  };
}

// helper เขียน audit แบบไม่ทำให้ route fail
async function safeAudit(payload) {
  try {
    await writeAuditLog(payload);
  } catch (e) {
    console.error("writeAuditLog failed:", e?.message || e);
  }
}

function pushStudentLog(student, entry, max = 200) {
  if (!Array.isArray(student.editLogs)) student.editLogs = [];
  student.editLogs.push({
    at: new Date(),
    by: clean(entry.by || ""),
    action: clean(entry.action || "แก้ไข"),
    field: clean(entry.field || ""),
    from: typeof entry.from === "undefined" ? "" : entry.from,
    to: typeof entry.to === "undefined" ? "" : entry.to,
    note: clean(entry.note || ""),
  });
  if (student.editLogs.length > max) {
    student.editLogs = student.editLogs.slice(-max);
  }
}

function normalizeLearnType(raw) {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  return v === "live" ? "live" : "classroom";
}

const ALLOWED_RECEIVE_TYPES = new Set(["ems", "on_class"]);
const ALLOWED_STUDENT_STATUS = new Set(["active", "cancelled", "postponed"]);

/* ================= PATCH: edit student ================= */

export async function PATCH(req, ctx) {
  try {
    // ✅ ต้องมีสิทธิ์แก้คลาส/ผู้เรียน
    const adminCtx = await requirePerm(PERM.CLASSES_WRITE);

    await dbConnect();

    const p = await ctx?.params;
    const classId = clean(p?.classId || p?.id);
    const studentId = clean(p?.studentId);

    if (!classId || !studentId)
      return jsonError("missing classId or studentId");

    const body = await req.json().catch(() => ({}));
    const note = clean(body.editNote || body.note || "");

    const klass = await Class.findById(classId).lean();
    if (!klass) return jsonError("class not found", 404);

    const student = await Student.findOne({ _id: studentId, classId });
    if (!student) return jsonError("student not found in this class", 404);

    const by =
      clean(
        adminCtx?.user?.name || adminCtx?.user?.username || adminCtx?.userId,
      ) || "admin";

    const before = pickStudentSnapshot(student);

    /* ===== log helper per field ===== */
    function setStr(field, next, actionLabel) {
      const prev = clean(student?.[field]);
      const after = clean(next);
      if (prev === after) return;
      student[field] = after;
      pushStudentLog(student, {
        by,
        action: actionLabel || "แก้ไข",
        field,
        from: prev,
        to: after,
        note,
      });
    }

    function setEnum(field, next, allowedSet, actionLabel) {
      const after = clean(next);
      if (!allowedSet.has(after)) return;
      const prev = clean(student?.[field]);
      if (prev === after) return;
      student[field] = after;
      pushStudentLog(student, {
        by,
        action: actionLabel || "แก้ไข",
        field,
        from: prev,
        to: after,
        note,
      });
    }

    function setBool(field, next, actionLabel) {
      const prev = Boolean(student?.[field]);
      const after = Boolean(next);
      if (prev === after) return;
      student[field] = after;
      pushStudentLog(student, {
        by,
        action: actionLabel || "แก้ไข",
        field,
        from: prev,
        to: after,
        note,
      });
    }

    /* ===== fields ===== */
    if ("name" in body) setStr("name", body.name, "แก้ไขชื่อ");
    if ("thaiName" in body) setStr("thaiName", body.thaiName, "แก้ไขชื่อ");
    if ("engName" in body) setStr("engName", body.engName, "แก้ไขชื่ออังกฤษ");
    if ("nameEN" in body) setStr("engName", body.nameEN, "แก้ไขชื่ออังกฤษ");

    if ("company" in body) setStr("company", body.company, "แก้ไขบริษัท");
    if ("paymentRef" in body)
      setStr("paymentRef", body.paymentRef, "แก้ไขเลขที่ QT/IV/RP");

    if ("documentReceiveType" in body) {
      setEnum(
        "documentReceiveType",
        body.documentReceiveType,
        ALLOWED_RECEIVE_TYPES,
        "เปลี่ยนช่องทางรับเอกสาร",
      );
    }

    if ("studentStatus" in body) {
      setEnum(
        "studentStatus",
        body.studentStatus,
        ALLOWED_STUDENT_STATUS,
        "เปลี่ยนสถานะผู้เรียน",
      );
    }

    if ("isLate" in body) setBool("isLate", body.isLate, "แก้ไขสถานะสาย");

    // ✅ learnType -> student.type + timeline/editCount
    if ("learnType" in body || "type" in body) {
      const nextType = normalizeLearnType(body.learnType ?? body.type);
      const prevType = normalizeLearnType(student.type);

      if (prevType !== nextType) {
        student.type = nextType;
        student.typeEditCount = Number(student.typeEditCount || 0) + 1;

        const eff = Number(body.learnTypeEffectiveDay ?? 1) || 1;

        if (Array.isArray(student.typeTimeline)) {
          const filtered = student.typeTimeline.filter(
            (x) => Number(x?.effectiveDay) !== eff,
          );
          filtered.push({
            effectiveDay: eff,
            type: nextType,
            at: new Date(),
            by,
            note: note || `effectiveDay=${eff}`,
          });
          filtered.sort(
            (a, b) => Number(a.effectiveDay) - Number(b.effectiveDay),
          );
          student.typeTimeline = filtered;
        }

        pushStudentLog(student, {
          by,
          action: "เปลี่ยนประเภทการเรียน",
          field: "type",
          from: prevType,
          to: nextType,
          note:
            note ||
            `effectiveDay=${Number(body.learnTypeEffectiveDay ?? 1) || 1}`,
        });
      }
    }

    await student.save();

    const after = pickStudentSnapshot(student);

    // ✅ Audit Log: update student
    await safeAudit({
      ctx: adminCtx,
      req,
      action: "update",
      entityType: "student",
      entityId: String(studentId),
      entityLabel:
        `${getStudentDisplayName(student)} • ${clean(klass?.title || klass?.courseTitle || "")}`.trim(),
      before,
      after,
      meta: {
        classId,
        note,
        changedKeys: Object.keys(body || {}),
      },
      // ไม่ต้อง diff editLogs เพราะบวม
      ignorePaths: ["editLogs"],
    });

    return NextResponse.json({ ok: true, student: student.toObject() });
  } catch (err) {
    console.error("PATCH student error:", err);
    return jsonError("internal server error", 500);
  }
}

/* ================= DELETE: remove student ================= */

export async function DELETE(req, ctx) {
  try {
    const adminCtx = await requirePerm(PERM.CLASSES_WRITE);
    await dbConnect();

    const p = await ctx?.params;
    const classId = clean(p?.classId || p?.id);
    const studentId = clean(p?.studentId);

    if (!classId || !studentId) {
      return jsonError("missing classId or studentId");
    }

    const klass = await Class.findById(classId).lean();
    if (!klass) return jsonError("class not found", 404);

    const stu = await Student.findOne({ _id: studentId, classId });
    if (!stu) return jsonError("student not found in this class", 404);

    const before = pickStudentSnapshot(stu);

    await Student.deleteOne({ _id: studentId, classId });

    await safeAudit({
      ctx: adminCtx,
      req,
      action: "delete",
      entityType: "student",
      entityId: String(studentId),
      entityLabel:
        `${getStudentDisplayName(stu)} • ${clean(klass?.title || klass?.courseTitle || "")}`.trim(),
      before,
      after: null,
      meta: { classId, deleted: true },
    });

    return NextResponse.json({ ok: true, deletedStudentId: studentId });
  } catch (err) {
    console.error("DELETE student error:", err);
    return jsonError("internal server error", 500);
  }
}
