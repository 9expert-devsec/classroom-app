import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";

export async function GET(req) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");

  if (!classId)
    return NextResponse.json(
      { error: "Missing classId" },
      { status: 400 }
    );

  const students = await Student.find({ classId }).sort({ thaiName: 1 });

  return NextResponse.json({
    ok: true,
    items: students,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
