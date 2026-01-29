// src/app/api/admin/student/import/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";

export const dynamic = "force-dynamic";

export async function POST(req) {
  await dbConnect();

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { classId, students } = body || {};

  if (!classId || !Array.isArray(students) || students.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Missing students data" },
      { status: 400 },
    );
  }

  const created = [];

  for (const s of students) {
    const docReceiveType = s.documentReceiveType || "ems";

    const newStudent = await Student.create({
      classId,
      thaiName: s.thaiName || "",
      engName: s.engName || "",
      company: s.company || "",
      paymentRef: s.paymentRef || "",
      documentReceiveType: docReceiveType,
      documentReceivedAt:
        docReceiveType === "on_class" && s.documentReceivedAt
          ? new Date(s.documentReceivedAt)
          : null,

      // ✅ สำคัญ: ทุกคน default = ไม่รับอาหาร
      // (เผื่ออนาคตมี code ที่ไป override default ใน schema)
      food: {
        noFood: true,
        restaurantId: "",
        menuId: "",
        addons: [],
        drink: "",
        note: "",
        classId: String(classId),
        day: null,
      },
    });

    created.push(newStudent);
  }

  return NextResponse.json({
    ok: true,
    created: created.length,
  });
}
