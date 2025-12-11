// src/app/api/checkin/sign/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";
import cloudinary from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

export async function POST(req) {
  await dbConnect();

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { studentId, signature } = body || {};

  if (!studentId || !signature) {
    return NextResponse.json(
      { ok: false, error: "studentId หรือ signature หายไป" },
      { status: 400 }
    );
  }

  const stu = await Student.findById(studentId);
  if (!stu) {
    return NextResponse.json(
      { ok: false, error: "ไม่พบ Student ตาม studentId" },
      { status: 404 }
    );
  }

  // 🔼 อัปโหลดลายเซ็นขึ้น Cloudinary (signature เป็น dataURL: data:image/png;base64,...)
  let uploadedUrl = stu.signatureUrl || "";

  try {
    const uploadRes = await cloudinary.uploader.upload(signature, {
      folder: "classroom/signatures",
      public_id: `${studentId}_day-sign_${Date.now()}`,
      overwrite: true,
      resource_type: "image",
    });

    uploadedUrl = uploadRes.secure_url;
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    return NextResponse.json(
      { ok: false, error: "อัปโหลดลายเซ็นไป Cloudinary ไม่สำเร็จ" },
      { status: 500 }
    );
  }

  // ✅ เก็บเฉพาะ URL จาก Cloudinary ในฐานข้อมูล
  stu.signatureUrl = uploadedUrl;
  stu.lastCheckinAt = new Date();

  await stu.save();

  return NextResponse.json({
    ok: true,
    studentId: stu._id,
    signatureUrl: stu.signatureUrl, // เป็น https://res.cloudinary.com/....png
  });
}
