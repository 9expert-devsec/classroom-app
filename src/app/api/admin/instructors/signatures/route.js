// src/app/api/admin/instructors/signatures/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import cloudinary from "@/lib/cloudinary";
import { uploadSignatureDataUrl } from "@/lib/cloudinaryUpload.server";
import AiInstructor from "@/models/AiInstructor";
import InstructorSignature from "@/models/InstructorSignature";
import {
  displayInstructorName,
  normalizeInstructorKey,
  normalizeInstructorName,
  resolveInstructorMatches,
  signaturePublicIdFor,
} from "@/lib/instructorSignature.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNATURE_FOLDER = "classroom/instructors/signatures";
// Limit applies to the DECODED image, not the base64 payload, so the effective
// cap is a real 2 MiB image (which travels as a ~2.8 MB data URL).
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024; // 2 MiB = 2,097,152 bytes
const DATA_URL_RE = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\s]+)$/i;

function clean(x) {
  return String(x ?? "").trim();
}

function jsonError(message, status = 500) {
  return NextResponse.json(
    { ok: false, error: message || "Server error" },
    { status },
  );
}

/**
 * Decoded byte length of a base64 payload, computed without decoding it:
 * len * 3 / 4 minus padding. Comparing the raw base64 length instead would
 * reject real images at ~3/4 of the nominal cap.
 */
function base64ByteLength(b64) {
  const s = String(b64 || "").replace(/\s/g, "");
  const padding = (s.match(/=+$/) || [""])[0].length;
  return Math.floor((s.length * 3) / 4) - padding;
}

/* ---------------- GET ---------------- */

export async function GET(req) {
  try {
    await requirePerm(PERM.CLASSES_READ);
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const q = clean(searchParams.get("q")).toLowerCase();
    const onlyMissing = searchParams.get("onlyMissing") === "1";

    const aiDocs = await AiInstructor.find(
      {},
      { externalId: 1, name: 1, email: 1, code: 1, "raw.name_th": 1, "raw.name_en": 1 },
    )
      .sort({ name: 1 })
      .lean();

    // Resolve every AiInstructor in one batch (two queries total).
    const matches = await resolveInstructorMatches(
      aiDocs.map((d) => ({
        name: d.name || d?.raw?.name_th || "",
        email: d.email || "",
        code: d.code || "",
      })),
    );

    const usedKeys = new Set();
    const usedNameKeys = new Set();

    const items = aiDocs.map((doc, i) => {
      const m = matches[i] || {};
      if (m.instructorKey) usedKeys.add(m.instructorKey);
      if (m.nameKey) usedNameKeys.add(m.nameKey);

      return {
        origin: "ai",
        key: m.instructorKey || "",
        nameKey: m.nameKey || "",
        externalId: String(doc.externalId || ""),
        // Thai name is the join key and the row identity here; the English name
        // is display-only and is maintained in MSDB, so it can be empty.
        name: m.nameTh || String(doc.name || doc?.raw?.name_th || ""),
        nameEn: m.nameEn || "",
        displayName: displayInstructorName(m),
        email: String(doc.email || ""),
        code: String(doc.code || ""),
        hasSignature: !!m.signature?.url,
        signatureUrl: m.signature?.url || "",
        source: m.signature?.source || "",
      };
    });

    // Any local record that does not correspond to an AiInstructor row - e.g.
    // an instructor uploaded manually before the MSDB sync knew about them.
    const localDocs = await InstructorSignature.find({ isActive: true }).lean();

    for (const doc of localDocs) {
      const key = String(doc.instructorKey || "");
      const nameKey = String(doc.nameKey || "");
      if (usedKeys.has(key) || (nameKey && usedNameKeys.has(nameKey))) continue;

      items.push({
        origin: "orphan",
        key,
        nameKey,
        externalId: String(doc.externalId || ""),
        name: String(doc.name || ""),
        nameEn: "",
        displayName: String(doc.name || ""),
        email: String(doc.email || ""),
        code: String(doc.code || ""),
        hasSignature: !!clean(doc?.signature?.url),
        signatureUrl: clean(doc?.signature?.url),
        source: clean(doc?.signature?.url) ? "local" : "",
      });
    }

    const filtered = items.filter((it) => {
      if (onlyMissing && it.hasSignature) return false;
      if (!q) return true;
      return [it.name, it.nameEn, it.email, it.code, it.key]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    return NextResponse.json({
      ok: true,
      total: items.length,
      count: filtered.length,
      items: filtered,
    });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}

/* ---------------- POST ---------------- */

export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.CLASSES_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));

    const name = clean(body?.name);
    const email = clean(body?.email);
    const code = clean(body?.code);
    const externalId = clean(body?.externalId);
    const dataUrl = clean(body?.dataUrl);

    const instructorKey = normalizeInstructorKey({ email, code, name });
    if (!instructorKey) {
      return jsonError("ต้องระบุชื่ออาจารย์ หรืออีเมล/รหัส อย่างน้อยหนึ่งอย่าง", 400);
    }

    const m = DATA_URL_RE.exec(dataUrl);
    if (!m) {
      return jsonError("ไฟล์ต้องเป็นรูปภาพ PNG / JPG / WEBP เท่านั้น", 400);
    }

    if (base64ByteLength(m[2]) > MAX_SIGNATURE_BYTES) {
      return jsonError("ไฟล์ใหญ่เกิน 2 MB", 400);
    }

    const nameKey = normalizeInstructorName(name);
    const publicId = signaturePublicIdFor(instructorKey);

    const uploaded = await uploadSignatureDataUrl(dataUrl, {
      folder: SIGNATURE_FOLDER,
      publicId,
    });

    const before = await InstructorSignature.findOne({ instructorKey }).lean();

    const after = await InstructorSignature.findOneAndUpdate(
      { instructorKey },
      {
        $set: {
          instructorKey,
          nameKey,
          name,
          email,
          code,
          externalId,
          isActive: true,
          signature: {
            url: uploaded.url || "",
            publicId: uploaded.publicId || "",
            width: uploaded.width || 0,
            height: uploaded.height || 0,
          },
          uploadedBy: {
            userId: clean(ctx?.user?.id),
            username: clean(ctx?.user?.username),
            name: clean(ctx?.user?.name),
          },
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    await writeAuditLog({
      ctx,
      req,
      action: "update",
      entityType: "instructor-signature",
      entityId: String(after?._id || ""),
      entityLabel: name || instructorKey,
      before,
      after,
    });

    return NextResponse.json({
      ok: true,
      item: {
        key: instructorKey,
        nameKey,
        name,
        email,
        code,
        externalId,
        hasSignature: !!after?.signature?.url,
        signatureUrl: after?.signature?.url || "",
        source: "local",
      },
    });
  } catch (e) {
    console.error("admin/instructors/signatures POST:", e);
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}

/* ---------------- DELETE ---------------- */

export async function DELETE(req) {
  try {
    const ctx = await requirePerm(PERM.CLASSES_WRITE);
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const instructorKey = clean(searchParams.get("key"));
    if (!instructorKey) return jsonError("missing key", 400);

    const before = await InstructorSignature.findOne({ instructorKey }).lean();
    if (!before) return jsonError("ไม่พบลายเซ็นของอาจารย์ท่านนี้", 404);

    // Always destroy by the stored publicId, never by a recomputed one, so an
    // asset uploaded under an older key scheme is still removed.
    const storedPublicId = clean(before?.signature?.publicId);
    let destroyResult = "skipped";

    if (storedPublicId) {
      try {
        const res = await cloudinary.uploader.destroy(storedPublicId, {
          resource_type: "image",
          invalidate: true,
        });
        destroyResult = clean(res?.result) || "unknown";
      } catch (err) {
        console.error("cloudinary destroy failed:", err);
        destroyResult = "error";
      }
    }

    // Soft delete: the row is kept for audit history, but the resolver only
    // ever reads isActive:true rows.
    const after = await InstructorSignature.findOneAndUpdate(
      { instructorKey },
      { $set: { isActive: false } },
      { new: true },
    ).lean();

    await writeAuditLog({
      ctx,
      req,
      action: "delete",
      entityType: "instructor-signature",
      entityId: String(before?._id || ""),
      entityLabel: before?.name || instructorKey,
      before,
      after,
      meta: { cloudinaryDestroy: destroyResult, publicId: storedPublicId },
    });

    return NextResponse.json({ ok: true, cloudinaryDestroy: destroyResult });
  } catch (e) {
    console.error("admin/instructors/signatures DELETE:", e);
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
