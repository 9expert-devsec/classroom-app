import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";
import { adminGuard } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";

export async function GET(req) {
  const denied = await adminGuard(PERM.CLASSES_READ);
  if (denied) return denied;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");

  if (!classId)
    return NextResponse.json(
      { error: "Missing classId" },
      { status: 400 }
    );

  const students = await Student.find({ classId }).sort({ createdAt: 1 });

  return NextResponse.json({
    ok: true,
    items: students,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
