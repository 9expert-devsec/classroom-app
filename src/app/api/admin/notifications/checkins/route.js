import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireAdmin } from "@/lib/adminAuth.server";
import Checkin from "@/models/Checkin";
import Student from "@/models/Student";
import Class from "@/models/Class";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(x) {
  return String(x || "").trim();
}

function formatTimeBKK(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

function pickCursorDate(row) {
  return (
    (row?.updatedAt && new Date(row.updatedAt)) ||
    (row?.time && new Date(row.time)) ||
    (row?.createdAt && new Date(row.createdAt)) ||
    new Date()
  );
}

export async function GET(req) {
  try {
    await requireAdmin();
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const since = clean(searchParams.get("since"));
    const sinceDate = since ? new Date(since) : null;

    // ✅ handshake: ถ้าไม่มี since -> ส่ง cursor ตอนนี้ + items ว่าง
    if (!sinceDate || Number.isNaN(sinceDate.getTime())) {
      return NextResponse.json(
        { ok: true, cursor: new Date().toISOString(), items: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // ✅ สำคัญ: ใช้ time ด้วย (บางเคส updatedAt อาจไม่ถูก set ตามที่คิด)
    const q = {
      $or: [
        { updatedAt: { $gt: sinceDate } },
        { time: { $gt: sinceDate } },
        { createdAt: { $gt: sinceDate } },
      ],
    };

    // ดึงล่าสุดก่อน แล้วค่อย reverse ให้เรียงเก่า->ใหม่
    const rows = await Checkin.find(q)
      .sort({ time: -1, updatedAt: -1 })
      .limit(20)
      .lean();

    const studentIds = [
      ...new Set(rows.map((r) => String(r.studentId || "")).filter(Boolean)),
    ];
    const classIds = [
      ...new Set(rows.map((r) => String(r.classId || "")).filter(Boolean)),
    ];

    const students = await Student.find({ _id: { $in: studentIds } })
      .select("name thaiName engName")
      .lean();

    const classes = await Class.find({ _id: { $in: classIds } })
      .select("title")
      .lean();

    const studentMap = new Map(students.map((s) => [String(s._id), s]));
    const classMap = new Map(classes.map((c) => [String(c._id), c]));

    const items = rows
      .slice()
      .reverse()
      .map((r) => {
        const st = studentMap.get(String(r.studentId)) || {};
        const cl = classMap.get(String(r.classId)) || {};

        const fullName =
          clean(st.name) ||
          clean(st.thaiName) ||
          clean(st.engName) ||
          "ผู้เรียน";

        const cursorDate = pickCursorDate(r);
        const cursor = cursorDate.toISOString();

        const timeText =
          formatTimeBKK(r.time) ||
          formatTimeBKK(r.updatedAt) ||
          formatTimeBKK(r.createdAt);

        const classTitle = clean(cl.title) || "ไม่ระบุคลาส";

        return {
          id: String(r._id),
          // ✅ eventId กันซ้ำ (สำคัญมาก เพราะ _id เดิมอาจถูก upsert)
          eventId: `${String(r._id)}:${cursor}`,
          cursor,
          message: `คุณ ${fullName} ได้ทำการเช็คอินเรียบร้อย เวลา ${timeText} จาก class ${classTitle}`,
        };
      });

    const newCursor = items.length ? items[items.length - 1].cursor : since;

    // ✅ ต้องเป็น object ไม่ใช่ array
    return NextResponse.json(
      { ok: true, cursor: newCursor, items },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || "ERROR" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
}
