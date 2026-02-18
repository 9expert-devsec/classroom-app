// src/app/api/classroom/import/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";

export const dynamic = "force-dynamic";

/* ---------------- helpers ---------------- */

function clean(s) {
  return String(s ?? "").trim();
}

function toLower(s) {
  return clean(s).toLowerCase();
}

function pickName(row) {
  // new template: name
  // old template: thaiName, engName
  const name = clean(row?.name);
  if (name) return name;

  const th = clean(row?.thaiName);
  if (th) return th;

  const en = clean(row?.engName);
  if (en) return en;

  return "";
}

function normalizeReceiveType(v) {
  // support: ems / onsite / on_class / on class / inclass etc.
  const s = toLower(v);
  if (!s) return "ems";
  if (s === "ems") return "ems";
  if (s === "onsite") return "on_class";
  if (s === "on_class") return "on_class";
  if (s === "on class") return "on_class";
  if (s === "inclass") return "on_class";
  if (s === "onclass") return "on_class";
  return "ems";
}

function normalizeStudentType(v) {
  // รองรับ: classroom | live
  // เผื่อพิมพ์อื่น ๆ: online/live-stream -> live
  const s = toLower(v);
  if (!s) return "classroom";
  if (s === "classroom") return "classroom";
  if (s === "live") return "live";
  if (s === "online") return "live";
  if (s === "livestream") return "live";
  if (s === "live-stream") return "live";
  return "classroom";
}

function parseExcelSerialDate(n) {
  // Excel serial date -> JS Date (UTC-ish). We treat as local date.
  // Excel epoch starts 1899-12-30 in most implementations.
  const num = Number(n);
  if (!Number.isFinite(num)) return null;
  const base = new Date(Date.UTC(1899, 11, 30));
  const ms = num * 24 * 60 * 60 * 1000;
  const d = new Date(base.getTime() + ms);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseDateMaybe(v) {
  const s = clean(v);
  if (!s) return null;

  // excel serial
  if (/^\d+(\.\d+)?$/.test(s)) {
    const d = parseExcelSerialDate(s);
    if (d) return d;
  }

  // YYYY-MM-DD or any Date parseable
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// ✅ Default food: ไม่รับอาหารเสมอตอน import
function defaultFood(classId) {
  return {
    // ให้ชัดเจน (ถึง schema จะ default อยู่แล้ว)
    choiceType: "",
    noFood: true,

    restaurantId: "",
    menuId: "",
    addons: [],
    drink: "",
    note: "",

    classId: String(classId || ""),
    day: null,
  };
}

/* ---------------- handler ---------------- */

export async function POST(req) {
  await dbConnect();

  const body = await req.json().catch(() => ({}));
  const { data, classId } = body || {};

  if (!classId) {
    return NextResponse.json({ error: "classId is required" }, { status: 400 });
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return NextResponse.json(
      { error: "CSV data is empty or invalid" },
      { status: 400 },
    );
  }

  // normalize + filter empty rows
  const rows = data
    .map((r) => (r && typeof r === "object" ? r : {}))
    .filter((r) => Object.values(r).some((v) => clean(v) !== ""));

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "CSV data is empty or invalid" },
      { status: 400 },
    );
  }

  const students = rows.map((r) => {
    const documentReceiveType = normalizeReceiveType(r.receiveType);

    let documentReceivedAt = null;
    // เก็บวันที่รับเอกสาร เฉพาะกรณีรับหน้างาน
    if (documentReceiveType === "on_class" && r.receiveDate) {
      documentReceivedAt = parseDateMaybe(r.receiveDate);
    }

    const name = pickName(r);
    const thLegacy = clean(r.thaiName) || name; // ✅ fallback เขียนทับให้ระบบเก่าอ่านได้
    const enLegacy = clean(r.engName);

    // ✅ new: ประเภท (type) -> Student.type
    // รองรับทั้ง header "type" และเผื่อ key ภาษาไทย "ประเภท"
    const type = normalizeStudentType(r.type ?? r["ประเภท"]);

    return {
      classId,

      type, // ✅ classroom | live

      name, // ✅ new unified field
      thaiName: thLegacy, // ✅ fallback
      engName: enLegacy,

      company: clean(r.company),
      paymentRef: clean(r.paymentRef),

      documentReceiveType,
      documentReceivedAt,

      // ✅ สำคัญ: ทุกคน default = ไม่รับอาหาร
      food: defaultFood(classId),
    };
  });

  // ถ้าชื่อว่างทุกแถว ถือว่าไฟล์ผิด
  const nonEmptyNameCount = students.reduce(
    (acc, s) => (s.name ? acc + 1 : acc),
    0,
  );
  if (nonEmptyNameCount === 0) {
    return NextResponse.json(
      { error: "ไม่พบชื่อผู้เข้าอบรม (name/thaiName/engName) ในไฟล์ CSV" },
      { status: 400 },
    );
  }

  // ถ้าบางแถวชื่อว่าง ให้ข้ามแถวนั้นไป (กัน insert แถวเสีย)
  const finalStudents = students.filter((s) => s.name);

  await Student.insertMany(finalStudents);

  return NextResponse.json({
    ok: true,
    inserted: finalStudents.length,
    skipped: students.length - finalStudents.length,
  });
}
