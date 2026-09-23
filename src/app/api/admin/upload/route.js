// src/app/api/admin/upload/route.js
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth.server";
import { uploadSignatureDataUrl } from "@/lib/cloudinaryUpload.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req) {
  try {
    await requireAdmin();

    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return jsonError("missing file", 400);
    }

    const mime = file.type || "application/octet-stream";
    if (!mime.startsWith("image/")) {
      return jsonError("file must be an image", 400);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;

    const { url } = await uploadSignatureDataUrl(dataUrl, {
      folder: "classroom/class-images",
    });

    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
