import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";

export const dynamic = "force-dynamic";

export async function POST(req) {
  await dbConnect();

  const body = await req.json();
  const { data, classId } = body;

  if (!classId) {
    return NextResponse.json(
      { error: "classId is required" },
      { status: 400 }
    );
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return NextResponse.json(
      { error: "CSV data is empty or invalid" },
      { status: 400 }
    );
  }

  const students = data.map((r) => {
    // r มาจาก header ใน CSV: thaiName, engName, company, paymentRef, receiveType, receiveDate
    const receiveType = (r.receiveType || "").toLowerCase();

    let documentReceiveType = "ems";
    if (receiveType === "onsite" || receiveType === "on_class") {
      documentReceiveType = "on_class";
    }

    let documentReceivedAt = null;
    if (documentReceiveType === "on_class" && r.receiveDate) {
      // assume format YYYY-MM-DD หรือ date string ที่ parse ได้
      documentReceivedAt = new Date(r.receiveDate);
    }

    return {
      classId,
      thaiName: r.thaiName || "",
      engName: r.engName || "",
      company: r.company || "",
      paymentRef: r.paymentRef || "",
      documentReceiveType,
      documentReceivedAt,
    };
  });

  await Student.insertMany(students);

  return NextResponse.json({
    ok: true,
    inserted: students.length,
  });
}
