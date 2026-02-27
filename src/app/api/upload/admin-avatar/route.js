// src/app/api/upload/admin-avatar/route.js
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { requireAdmin } from "@/lib/adminAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req) {
  try {
    await requireAdmin();

    const form = await req.formData();
    const file = form.get("file");

    if (!file) return jsonError("Missing file", 400);
    if (typeof file === "string") return jsonError("Invalid file", 400);

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "classroom-admin-avatars",
          resource_type: "image",
          overwrite: true,
        },
        (err, res) => (err ? reject(err) : resolve(res)),
      );
      stream.end(buf);
    });

    return NextResponse.json({
      ok: true,
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
