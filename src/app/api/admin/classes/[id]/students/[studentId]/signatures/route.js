import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";

import Student from "@/models/Student";
import Checkin from "@/models/Checkin";
import DocumentReceipt from "@/models/DocumentReceipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------- helpers ---------------- */

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function clean(s) {
  return String(s ?? "").trim();
}

function safeBool(x) {
  return !!x;
}

async function safeAudit(payload) {
  try {
    await writeAuditLog(payload);
  } catch (e) {
    console.error("writeAuditLog failed:", e?.message || e);
  }
}

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeDocId(x) {
  let s = String(x || "")
    .trim()
    .toUpperCase();
  s = s.replace(/\s+/g, " ");
  s = s.replace(/\s*-\s*/g, "-");

  let m = s.match(/^([A-Z]{2,10})\s+([0-9]{1,20})$/);
  if (m) return `${m[1]}-${m[2]}`;

  m = s.match(/^([A-Z]{2,10})([0-9]{1,20})$/);
  if (m) return `${m[1]}-${m[2]}`;

  return s;
}

function parseDocParts(docNorm) {
  const s = normalizeDocId(docNorm);
  const m = s.match(/^([A-Z]{2,10})-([0-9]{1,20})$/);
  if (!m) return null;
  return { prefix: m[1], num: m[2] };
}

function buildDocVariants(docNorm) {
  const norm = normalizeDocId(docNorm);
  const parts = parseDocParts(norm);
  if (!parts) return [norm];

  const { prefix, num } = parts;
  const set = new Set([
    `${prefix}-${num}`,
    `${prefix} ${num}`,
    `${prefix}${num}`,
  ]);
  return Array.from(set);
}

function buildDocLooseRegex(docNorm) {
  const parts = parseDocParts(docNorm);
  if (!parts) {
    const raw = escapeRegExp(normalizeDocId(docNorm));
    return new RegExp(`^\\s*${raw}\\s*$`, "i");
  }
  const { prefix, num } = parts;
  return new RegExp(
    `^\\s*${escapeRegExp(prefix)}\\s*[- ]?\\s*${escapeRegExp(num)}\\s*$`,
    "i",
  );
}

function getStudentLabel(stu) {
  const name =
    clean(stu?.name) || clean(stu?.thaiName) || clean(stu?.engName) || "-";
  const company = clean(stu?.company);
  return company ? `${name} (${company})` : name;
}

// ถ้ามี helper ลบ Cloudinary ของคุณอยู่แล้ว ให้เปลี่ยนมาใช้ของคุณแทน
async function tryDeleteCloudinary(publicId) {
  const pid = clean(publicId);
  if (!pid) return;

  try {
    const mod = await import("cloudinary");
    const cloudinary = mod.v2;
    await cloudinary.uploader.destroy(pid, { invalidate: true });
  } catch (e) {
    console.warn("cloudinary destroy failed:", pid, e?.message || e);
  }
}

/* ---------------- DELETE ---------------- */
// body:
//  { kind: "checkin", day: 2 }
//  | { kind:"receive_3_1" }
//  | { kind:"staff_3_2", who:"customer"|"staff" }
export async function DELETE(req, ctx) {
  try {
    const adminCtx = await requirePerm(PERM.CLASSES_WRITE);
    await dbConnect();

    const p = await ctx?.params;
    const classId = clean(p?.classId || p?.id);
    const studentId = clean(p?.studentId);

    if (!classId || !studentId)
      return jsonError("missing classId or studentId");

    const body = await req.json().catch(() => ({}));
    const kind = clean(body?.kind);
    if (!kind) return jsonError("missing kind");

    const student = await Student.findOne({ _id: studentId, classId });
    if (!student) return jsonError("student not found in this class", 404);

    const studentLabel = getStudentLabel(student);
    const paymentNorm = normalizeDocId(student.paymentRef);

    /* ===== 1) delete checkin signature ===== */
    if (kind === "checkin") {
      const day = Number(body?.day || 0);
      if (!day) return jsonError("missing day");

      const checkin = await Checkin.findOne({ classId, studentId, day });
      if (!checkin) return jsonError("checkin not found", 404);

      const oldUrl = clean(checkin.signatureUrl);
      const oldPid =
        clean(checkin.signaturePublicId) ||
        clean(checkin.sigPublicId) ||
        clean(checkin.publicId) ||
        "";

      // ✅ ลบ checkin record ของวันนั้น
      await Checkin.deleteOne({ _id: checkin._id });

      // ✅ รีเซ็ต flag ใน Student
      const dayKey = `day${day}`;
      if (
        student.checkinStatus &&
        Object.prototype.hasOwnProperty.call(student.checkinStatus, dayKey)
      ) {
        student.checkinStatus[dayKey] = false;
      }

      // ✅ เคลียร์ fallback signature บน Student ถ้าตรงกับของเดิม
      if (oldUrl && clean(student.signatureUrl) === oldUrl) {
        student.signatureUrl = "";
      }

      // ✅ recompute lastCheckinAt / isLate จากวันอื่นที่ยังเหลือ
      const remain = await Checkin.find({ classId, studentId })
        .select("time isLate signatureUrl createdAt")
        .lean();

      const times = (remain || [])
        .map((r) => {
          const t = r?.time ? new Date(r.time).getTime() : NaN;
          if (Number.isFinite(t)) return t;
          const ca = r?.createdAt ? new Date(r.createdAt).getTime() : NaN;
          return Number.isFinite(ca) ? ca : NaN;
        })
        .filter((x) => Number.isFinite(x));

      student.lastCheckinAt = times.length
        ? new Date(Math.max(...times))
        : null;
      student.isLate = (remain || []).some((r) => !!r?.isLate);

      student.editLogs = Array.isArray(student.editLogs)
        ? student.editLogs
        : [];
      student.editLogs.push({
        at: new Date(),
        by: clean(adminCtx?.user?.name || adminCtx?.user?.username || ""),
        action: "ลบเช็คอิน",
        field: `checkin.day${day}`,
        from: oldUrl ? "signed" : "checked",
        to: "cleared",
        note: "",
      });

      await student.save();

      if (oldPid) await tryDeleteCloudinary(oldPid);

      // ✅ audit
      await safeAudit({
        ctx: adminCtx,
        req,
        action: "delete",
        entityType: "signature",
        entityId: `${studentId}__checkin__day${day}`,
        entityLabel: `${studentLabel} • checkin day ${day}`,
        before: {
          kind: "checkin",
          day,
          hadSignature: safeBool(oldUrl || oldPid),
          signatureUrl: oldUrl,
          publicId: oldPid,
          classId,
          studentId,
        },
        after: {
          kind: "checkin",
          day,
          hadSignature: false,
          signatureUrl: "",
          publicId: "",
          classId,
          studentId,
        },
        meta: { classId, studentId, kind: "checkin", day },
      });

      return NextResponse.json({ ok: true });
    }

    /* ===== 2) delete receive (3.1) signature ===== */
    if (kind === "receive_3_1") {
      const docNorm = paymentNorm;
      if (!docNorm) return jsonError("student has no paymentRef/docId");

      const variants = buildDocVariants(docNorm);
      const docRegex = buildDocLooseRegex(docNorm);

      const receipt =
        (await DocumentReceipt.findOne({
          classId,
          type: "customer_receive",
          docId: { $in: variants },
        })) ||
        (await DocumentReceipt.findOne({
          classId,
          type: "customer_receive",
          docId: docRegex,
        }));

      if (!receipt) return jsonError("document receipt (3.1) not found", 404);

      const receivers = Array.isArray(receipt.receivers)
        ? receipt.receivers
        : [];
      if (!receivers.length) return jsonError("no receivers in receipt", 404);

      const oldPidSet = new Set();
      const oldUrlSet = new Set();

      for (const rcv of receivers) {
        const sig = rcv?.receiptSig || null;
        if (sig?.publicId) oldPidSet.add(sig.publicId);
        if (sig?.url) oldUrlSet.add(clean(sig.url));
      }

      receipt.receivers = receivers.map((x) => ({
        ...x,
        receiptSig: {
          url: "",
          publicId: "",
          signedAt: null,
          signerName: "",
          signerRole: "customer",
        },
      }));

      await receipt.save();

      // ล้าง cache บน Student ทุกคนที่ paymentRef เดียวกัน
      const payRegex = buildDocLooseRegex(docNorm);

      const upd = await Student.updateMany(
        { classId, paymentRef: payRegex },
        {
          $set: {
            documentReceiptSigUrl: "",
            documentReceiptSigPublicId: "",
            documentReceiptSignedAt: null,
            documentReceivedAt: null,
          },
        },
      );

      // กันตัวที่โหลดมาก่อนถูก save ทับค่าเก่า
      student.documentReceiptSigUrl = "";
      student.documentReceiptSigPublicId = "";
      student.documentReceiptSignedAt = null;
      student.documentReceivedAt = null;
      await student.save();

      for (const pid of oldPidSet) {
        await tryDeleteCloudinary(pid);
      }

      await safeAudit({
        ctx: adminCtx,
        req,
        action: "delete",
        entityType: "signature",
        entityId: `${studentId}__receive_3_1__${docNorm}`,
        entityLabel: `${studentLabel} • receive 3.1 • ${docNorm}`,
        before: {
          kind: "receive_3_1",
          docId: docNorm,
          receiptId: String(receipt._id),
          hadSignature: oldPidSet.size > 0 || oldUrlSet.size > 0,
          sigCount: oldPidSet.size || oldUrlSet.size,
          classId,
          studentId,
        },
        after: {
          kind: "receive_3_1",
          docId: docNorm,
          receiptId: String(receipt._id),
          hadSignature: false,
          sigCount: 0,
          classId,
          studentId,
        },
        meta: {
          classId,
          studentId,
          kind: "receive_3_1",
          docId: docNorm,
          receiptId: String(receipt._id),
          clearedStudents:
            Number(upd?.modifiedCount ?? upd?.nModified ?? 0) || undefined,
          oldPidCount: oldPidSet.size,
        },
      });

      return NextResponse.json({ ok: true });
    }

    /* ===== 3) delete staff receive (3.2) signature ===== */
    if (kind === "staff_3_2") {
      const who = clean(body?.who); // "customer" | "staff"
      if (who !== "customer" && who !== "staff")
        return jsonError("missing who");

      const docNorm = paymentNorm;
      if (!docNorm) return jsonError("student has no paymentRef/docId");

      const variants = buildDocVariants(docNorm);
      const docRegex = buildDocLooseRegex(docNorm);

      const receipt =
        (await DocumentReceipt.findOne({
          classId,
          type: "staff_receive",
          docId: { $in: variants },
        })) ||
        (await DocumentReceipt.findOne({
          classId,
          type: "staff_receive",
          docId: docRegex,
        }));

      if (!receipt) return jsonError("staff receipt (3.2) not found", 404);

      const oldPid =
        who === "customer"
          ? clean(receipt?.customerSig?.publicId)
          : clean(receipt?.staffSig?.publicId);

      const oldUrl =
        who === "customer"
          ? clean(receipt?.customerSig?.url)
          : clean(receipt?.staffSig?.url);

      if (who === "customer") {
        receipt.customerSig = {
          url: "",
          publicId: "",
          signedAt: null,
          signerRole: "customer",
        };
      } else {
        receipt.staffSig = {
          url: "",
          publicId: "",
          signedAt: null,
          signerRole: "staff",
        };
      }

      const staffUrlAfter =
        who === "staff" ? "" : clean(receipt?.staffSig?.url);
      const custUrlAfter =
        who === "customer" ? "" : clean(receipt?.customerSig?.url);
      const hasAnySigAfter = !!staffUrlAfter || !!custUrlAfter;

      if (hasAnySigAfter) {
        await receipt.save();
      } else {
        await DocumentReceipt.deleteOne({ _id: receipt._id });
      }

      // ล้าง cache บน Student ทุกคนที่ paymentRef เดียวกัน
      const payRegex = buildDocLooseRegex(docNorm);
      const upd = await Student.updateMany(
        { classId, paymentRef: payRegex },
        { $set: { receiveType: "", receiveDate: null } },
      );

      if (oldPid) await tryDeleteCloudinary(oldPid);

      await safeAudit({
        ctx: adminCtx,
        req,
        action: "delete",
        entityType: "signature",
        entityId: `${studentId}__staff_3_2__${who}__${docNorm}`,
        entityLabel: `${studentLabel} • staff 3.2 (${who}) • ${docNorm}`,
        before: {
          kind: "staff_3_2",
          who,
          docId: docNorm,
          receiptId: String(receipt._id),
          hadSignature: safeBool(oldUrl || oldPid),
          signatureUrl: oldUrl,
          publicId: oldPid,
          classId,
          studentId,
        },
        after: {
          kind: "staff_3_2",
          who,
          docId: docNorm,
          receiptId: hasAnySigAfter ? String(receipt._id) : "",
          hadSignature: false,
          signatureUrl: "",
          publicId: "",
          classId,
          studentId,
          receiptDeleted: !hasAnySigAfter,
        },
        meta: {
          classId,
          studentId,
          kind: "staff_3_2",
          who,
          docId: docNorm,
          receiptId: String(receipt._id),
          receiptDeleted: !hasAnySigAfter,
          clearedStudents:
            Number(upd?.modifiedCount ?? upd?.nModified ?? 0) || undefined,
        },
      });

      return NextResponse.json({ ok: true });
    }

    return jsonError("unknown kind");
  } catch (err) {
    console.error("DELETE signatures error:", err);
    return jsonError("internal server error", 500);
  }
}
