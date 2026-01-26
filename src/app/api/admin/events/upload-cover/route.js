import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

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

async function destroyIfExists(publicId) {
  const pid = clean(publicId);
  if (!pid) return;
  try {
    await cloudinary.uploader.destroy(pid, { resource_type: "image" });
  } catch {
    // ignore
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const dataUrl = clean(body.dataUrl);
    const oldPublicId = clean(body.oldPublicId);

    if (!dataUrl.startsWith("data:image")) {
      return NextResponse.json(
        { ok: false, error: "invalid image" },
        { status: 400 },
      );
    }

    // ลบรูปเก่าก่อน (ถ้ามี)
    if (oldPublicId) await destroyIfExists(oldPublicId);

    const res = await cloudinary.uploader.upload(dataUrl, {
      folder: "classroom/events",
      resource_type: "image",
      overwrite: true,
    });

    return NextResponse.json({
      ok: true,
      url: res.secure_url,
      publicId: res.public_id,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
