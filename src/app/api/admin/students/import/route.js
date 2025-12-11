import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";

export async function POST(req) {
  await dbConnect();

  const { classId, students } = await req.json();

  if (!classId || !students || !students.length) {
    return NextResponse.json(
      { error: "Missing students data" },
      { status: 400 }
    );
  }

  const created = [];

  for (const s of students) {
    const newStudent = await Student.create({
      classId,
      thaiName: s.thaiName,
      engName: s.engName,
      company: s.company,
      paymentRef: s.paymentRef,
      documentReceiveType: s.documentReceiveType || "ems",
      documentReceivedAt:
        s.documentReceiveType === "on_class"
          ? new Date(s.documentReceivedAt)
          : null,
    });

    created.push(newStudent);
  }

  return NextResponse.json({
    ok: true,
    created: created.length,
  });
}
