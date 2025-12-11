// src/app/api/checkin/food/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";

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

  const {
    studentId,
    restaurantId,
    menuId,
    addons = [],
    drink = "",
    note = "",
  } = body;

  if (!studentId) {
    return NextResponse.json(
      { ok: false, error: "studentId is required" },
      { status: 400 }
    );
  }

  const student = await Student.findById(studentId);
  if (!student) {
    return NextResponse.json(
      { ok: false, error: "Student not found" },
      { status: 404 }
    );
  }

  // ✅ เซฟข้อมูลอาหารทั้งหมดไว้ใน student.food
  student.food = {
    restaurantId: restaurantId || "",
    menuId: menuId || "",
    addons: Array.isArray(addons) ? addons : [],
    drink,
    note,
  };

  await student.save();

  return NextResponse.json({ ok: true });
}
