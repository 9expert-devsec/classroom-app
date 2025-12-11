import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Class from "@/models/Class";
// ❗ TODO: เปลี่ยนชื่อ Model ให้ตรงของจริง
// เช่น "@/models/Registration" หรือ "@/models/Register"
import Registration from "@/models/Registration";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/classes/[id]/sync-from-registrations
 * ดึงรายชื่อนักเรียนจากระบบลงทะเบียน แล้ว map เข้า Class.students
 */
export async function POST(req, { params }) {
  await dbConnect();
  const { id } = params;

  const cls = await Class.findById(id);
  if (!cls) {
    return NextResponse.json(
      { ok: false, error: "Class not found" },
      { status: 404 }
    );
  }

  // 1) คำนวณช่วงวันที่ของ Class
  const start = new Date(cls.date);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json(
      { ok: false, error: "Class.date ไม่ถูกต้อง" },
      { status: 400 }
    );
  }
  const dayCount = cls.duration?.dayCount || cls.dayCount || 1;
  const end = new Date(start);
  end.setDate(end.getDate() + (dayCount - 1));

  // 2) ดึง registrations ตาม courseCode + ช่วงวันที่
  // ❗ ส่วนนี้ต้องปรับ field ให้ตรงกับ schema จริงของคุณ
  const regs = await Registration.find({
    courseCode: cls.courseCode, // หรือ field อื่นที่ใช้ผูก course
    // เช่น ถ้ามี field scheduleDate หรือ trainingDate:
    trainingDate: { $gte: start, $lte: end },
  }).lean();

  // ถ้าระบบคุณเก็บวันที่บน registration ในชื่ออื่น
  // ให้ปรับ query ข้างบนตามนั้น

  // 3) map registrations -> students[]
  const students = [];

  for (const reg of regs) {
    const company =
      reg.company ||
      reg.org_name ||
      reg.organization ||
      reg.contact_company ||
      "";

    // สมมติว่ามี reg.attendees เป็น array
    const attendeeList =
      reg.attendees && Array.isArray(reg.attendees)
        ? reg.attendees
        : [
            {
              nameTH: reg.contact_name || reg.name,
              nameEN: reg.contact_name_en || "",
            },
          ];

    for (const att of attendeeList) {
      students.push({
        nameTH: att.nameTH || att.fullname || att.name || reg.contact_name || "",
        nameEN: att.nameEN || "",
        company,
        checkin: {
          day1: false,
          day2: false,
          day3: false,
        },
        late: false,
      });
    }
  }

  // 4) เซฟเข้า Class
  cls.students = students;
  await cls.save();

  return NextResponse.json({
    ok: true,
    count: students.length,
  });
}
