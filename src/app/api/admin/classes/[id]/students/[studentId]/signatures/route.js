// src/app/api/admin/classes/[id]/students/[studentId]/signatures/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { requireAdmin } from "@/lib/adminAuth.server";

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

function normalizeDocId(x) {
  let s = String(x || "")
    .trim()
    .toUpperCase();
  s = s.replace(/\s+/g, " ");
  s = s.replace(/\s*-\s*/g, "-");
  const m = s.match(/^([A-Z]{2,10})\s+([0-9]{1,20})$/);
  if (m) return `${m[1]}-${m[2]}`;
  return s;
}

// ถ้ามี helper ลบ Cloudinary ของคุณอยู่แล้ว ให้เปลี่ยนมาใช้ของคุณแทน
async function tryDeleteCloudinary(publicId) {
  const pid = clean(publicId);
  if (!pid) return;

  // ถ้าคุณยังไม่ได้เก็บ publicId ใน DB -> จะลบไฟล์จริงไม่ได้ (ลบได้แค่ url)
  try {
    const mod = await import("cloudinary");
    const cloudinary = mod.v2;

    // cloudinary.config(...) มักตั้งไว้ส่วนกลางแล้ว
    await cloudinary.uploader.destroy(pid, { invalidate: true });
  } catch (e) {
    // ไม่ให้ fail ทั้ง request ถ้าลบไฟล์ไม่ได้
    console.warn("cloudinary destroy failed:", pid, e?.message || e);
  }
}

/* ---------------- DELETE ---------------- */
// body: { kind: "checkin", day: 2 } | { kind:"receive_3_1" } | { kind:"staff_3_2", who:"customer"|"staff" }
export async function DELETE(req, ctx) {
  try {
    const admin = await requireAdmin();
    await dbConnect();

    const p = await ctx?.params;
    const classId = clean(p?.classId || p?.id); // กันพลาดชื่อ param
    const studentId = clean(p?.studentId);

    if (!classId || !studentId)
      return jsonError("missing classId or studentId");

    const body = await req.json().catch(() => ({}));
    const kind = clean(body?.kind);

    if (!kind) return jsonError("missing kind");

    // โหลด student ไว้ใช้หลายเคส
    const student = await Student.findOne({ _id: studentId, classId });
    if (!student) return jsonError("student not found in this class", 404);

    /* ===== 1) delete checkin signature ===== */
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

      // ✅ 1) ลบ checkin record ของวันนั้น (ทำให้ "เวลา" หายแน่นอน)
      await Checkin.deleteOne({ _id: checkin._id });

      // ✅ 2) รีเซ็ต flag ใน Student (ถ้าคีย์นั้นมีอยู่)
      const dayKey = `day${day}`;
      if (
        student.checkinStatus &&
        Object.prototype.hasOwnProperty.call(student.checkinStatus, dayKey)
      ) {
        student.checkinStatus[dayKey] = false;
      }

      // ✅ 3) เคลียร์ fallback signature บน Student ถ้าตรงกับของเดิม
      if (oldUrl && clean(student.signatureUrl) === oldUrl) {
        student.signatureUrl = "";
      }

      // ✅ 4) recompute lastCheckinAt / isLate จากวันอื่นที่ยังเหลือ
      const remain = await Checkin.find({ classId, studentId })
        .select("time isLate signatureUrl")
        .lean();
      const times = remain
        .map((r) => (r?.time ? new Date(r.time).getTime() : 0))
        .filter(Boolean);
      const maxTime = times.length ? new Date(Math.max(...times)) : null;

      student.lastCheckinAt = maxTime;
      student.isLate = remain.some((r) => !!r?.isLate);

      // (optional) log
      student.editLogs = Array.isArray(student.editLogs)
        ? student.editLogs
        : [];
      student.editLogs.push({
        at: new Date(),
        by: clean(admin?.email || admin?.name || ""),
        action: "ลบเช็คอิน",
        field: `checkin.day${day}`,
        from: oldUrl ? "signed" : "checked",
        to: "cleared",
        note: "",
      });

      await student.save();

      if (oldPid) await tryDeleteCloudinary(oldPid);

      return NextResponse.json({ ok: true });
    }

    /* ===== 2) delete receive (3.1) signature ===== */
    if (kind === "receive_3_1") {
      const docNorm = normalizeDocId(student.paymentRef);
      if (!docNorm) return jsonError("student has no paymentRef/docId");

      // หา receipt ที่ docId ตรง (normalize เทียบ)
      const receipts = await DocumentReceipt.find({
        classId,
        type: { $ne: "staff_receive" },
      });

      const receipt = receipts.find(
        (r) => normalizeDocId(r?.docId) === docNorm,
      );
      if (!receipt) return jsonError("document receipt (3.1) not found", 404);

      // ลบทุก receiver ของ doc เดียวกัน (เพราะระบบคุณ treat เป็นลายเซ็น shared ของ INV)
      const oldPids = [];
      const receivers = Array.isArray(receipt.receivers)
        ? receipt.receivers
        : [];

      receipt.receivers = receivers.map((x) => {
        const sig = x?.receiptSig || null;
        if (sig?.publicId) oldPids.push(sig.publicId);
        return {
          ...x,
          receiptSig: {
            url: "",
            publicId: "",
            signedAt: null,
            signerRole: "customer",
          },
        };
      });

      await receipt.save();

      // ล้าง cache บน Student ด้วย
      student.documentReceiptSigUrl = "";
      student.documentReceiptSigPublicId = "";
      student.documentReceiptSignedAt = null;
      await student.save();

      // ลบไฟล์ (ถ้ามี)
      for (const pid of oldPids) {
        await tryDeleteCloudinary(pid);
      }

      return NextResponse.json({ ok: true });
    }

    /* ===== 3) delete staff receive (3.2) signature ===== */
    if (kind === "staff_3_2") {
      const who = clean(body?.who); // "customer" | "staff"
      if (who !== "customer" && who !== "staff")
        return jsonError("missing who");

      const docNorm = normalizeDocId(student.paymentRef);
      if (!docNorm) return jsonError("student has no paymentRef/docId");

      const receipts = await DocumentReceipt.find({
        classId,
        type: "staff_receive",
      });
      const receipt = receipts.find(
        (r) => normalizeDocId(r?.docId) === docNorm,
      );
      if (!receipt) return jsonError("staff receipt (3.2) not found", 404);

      const oldPid =
        who === "customer"
          ? clean(receipt?.customerSig?.publicId)
          : clean(receipt?.staffSig?.publicId);

      if (who === "customer")
        receipt.customerSig = { url: "", publicId: "", signedAt: null };
      else receipt.staffSig = { url: "", publicId: "", signedAt: null };

      await receipt.save();

      if (oldPid) await tryDeleteCloudinary(oldPid);

      return NextResponse.json({ ok: true });
    }

    return jsonError("unknown kind");
  } catch (err) {
    console.error("DELETE signatures error:", err);
    return jsonError("internal server error", 500);
  }
}
