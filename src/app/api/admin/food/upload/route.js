// src/app/api/admin/food/upload/route.js
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs"; // ให้รันบน Node (ใช้ Buffer ได้)

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "missing_file" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const mime = file.type || "image/jpeg";
    const dataURI = `data:${mime};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataURI, {
      folder: "classroom-food",
    });

    return NextResponse.json(
      {
        ok: true,
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        format: result.format,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "upload_failed" },
      { status: 500 },
    );
  }
}
