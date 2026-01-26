import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Event from "@/models/Event";
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

export async function GET(_req, { params }) {
  try {
    await dbConnect();
    const id = String(params?.id || "");
    const item = await Event.findById(id).lean();
    if (!item)
      return NextResponse.json(
        { ok: false, error: "not found" },
        { status: 404 },
      );
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}

export async function PUT(req, { params }) {
  try {
    await dbConnect();
    const id = String(params?.id || "");
    const body = await req.json().catch(() => ({}));

    const doc = await Event.findById(id);
    if (!doc)
      return NextResponse.json(
        { ok: false, error: "not found" },
        { status: 404 },
      );

    const title = clean(body.title);
    if (!title)
      return NextResponse.json(
        { ok: false, error: "missing title" },
        { status: 400 },
      );

    const startAt = body.startAt ? new Date(body.startAt) : null;
    const endAt = body.endAt ? new Date(body.endAt) : null;

    if (!startAt || Number.isNaN(startAt.getTime())) {
      return NextResponse.json(
        { ok: false, error: "invalid startAt" },
        { status: 400 },
      );
    }

    // cover image replace/remove
    const newCoverUrl = clean(body.coverImageUrl);
    const newCoverPid = clean(body.coverImagePublicId);

    // ถ้าส่ง prevCoverPublicId มา และ publicId ใหม่ต่าง/ว่าง → ลบของเก่า
    const prevPid = clean(body.prevCoverImagePublicId);
    if (prevPid && prevPid !== newCoverPid) {
      await destroyIfExists(prevPid);
    }

    doc.title = title;
    doc.location = clean(body.location);
    doc.note = clean(body.note);
    doc.startAt = startAt;
    doc.endAt = endAt && !Number.isNaN(endAt.getTime()) ? endAt : null;
    doc.isActive = body.isActive !== false;

    doc.coverImageUrl = newCoverUrl;
    doc.coverImagePublicId = newCoverPid;

    await doc.save();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}

export async function DELETE(_req, { params }) {
  try {
    await dbConnect();
    const id = String(params?.id || "");
    const doc = await Event.findById(id);
    if (!doc) return NextResponse.json({ ok: true });

    // ลบรูป cover ด้วย
    if (doc.coverImagePublicId) await destroyIfExists(doc.coverImagePublicId);

    await doc.deleteOne();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
