// src/app/admin/classroom/page.jsx
import Link from "next/link";
import dbConnect from "@/lib/mongoose";
import Class from "@/models/Class";
import Student from "@/models/Student";
import Checkin from "@/models/Checkin";

function getRangeDates(range) {
  const now = new Date();

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (range === "week") {
    // 7 วันล่าสุด (วันนี้ + ย้อนหลัง 6 วัน)
    start.setDate(start.getDate() - 6);
  } else if (range === "month") {
    // ตั้งแต่วันที่ 1 ของเดือนนี้
    start.setDate(1);
  }

  return { start, end };
}

const RANGE_OPTIONS = [
  { key: "today", label: "วันนี้" },
  { key: "week", label: "7 วันล่าสุด" },
  { key: "month", label: "เดือนนี้" },
];

function getRangeLabel(range) {
  const found = RANGE_OPTIONS.find((r) => r.key === range);
  return found ? found.label : "วันนี้";
}

export default async function ClassroomDashboard({ searchParams }) {
  const range = searchParams?.range || "today";
  const rangeLabel = getRangeLabel(range);

  await dbConnect();
  const { start, end } = getRangeDates(range);

  /** ---------------- 1) ดึง Class ตามช่วงเวลา ----------------
   *   - เคสใหม่: มี startDate / endDate → หา class ที่ช่วงวันที่ “ทับซ้อน” กับช่วงที่เลือก
   *   - เคสเก่า: มี field เดิมชื่อ date → ใช้ date ในช่วงที่เลือก
   */
  const classes = await Class.find({
    $or: [
      {
        // class ที่มีช่วงวันที่เริ่ม–วันจบ (ทับซ้อนกับช่วงที่เลือก)
        startDate: { $exists: true },
        endDate: { $exists: true },
        startDate: { $lte: end },
        endDate: { $gte: start },
      },
      {
        // เผื่อ class เก่า ๆ ที่ใช้ field ชื่อ date
        date: { $gte: start, $lt: end },
      },
    ],
  }).lean();

  const classIds = classes.map((c) => c._id);

  /** ---------------- 2) ดึง Student ทุกคนในคลาสช่วงนี้ ---------------- */
  const students =
    classIds.length > 0
      ? await Student.find({ classId: { $in: classIds } }).lean()
      : [];

  /** ---------------- 3) ดึง Check-in ในช่วงเวลา ---------------- */
  const checkins = await Checkin.find({
    time: { $gte: start, $lt: end },
  })
    .populate("studentId", "thaiName engName")
    .populate("classId", "classCode title room")
    .lean();

  const totalClasses = classes.length;
  const totalStudents = students.length;
  const totalCheckins = checkins.length;
  const lateCount = checkins.filter((c) => c.isLate).length;

  /** ---------------- 4) เมนูยอดฮิตจาก Student.food.menuId ---------------- */
  const menuCountMap = new Map();
  students.forEach((s) => {
    const f = s.food;
    if (f && f.menuId) {
      const key = f.menuId;
      menuCountMap.set(key, (menuCountMap.get(key) || 0) + 1);
    }
  });

  const topMenus = [...menuCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header + Range Tabs */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Classroom Dashboard</h1>
          <p className="text-sm text-admin-textMuted">
            ภาพรวม Class / ผู้เรียน / การเช็คอิน &amp; เมนูอาหาร ในช่วงเวลา{" "}
            {rangeLabel}
          </p>
        </div>

        <div className="inline-flex rounded-full bg-admin-surface border border-admin-border p-1 text-xs">
          {RANGE_OPTIONS.map((opt) => (
            <Link
              key={opt.key}
              href={`/admin/classroom?range=${opt.key}`}
              className={
                "px-3 py-1 rounded-full transition " +
                (range === opt.key
                  ? "bg-brand-primary text-white"
                  : "text-admin-textMuted hover:bg-admin-surfaceMuted")
              }
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-admin-surface p-4 shadow-card">
          <p className="text-xs text-admin-textMuted">
            จำนวนคลาสในช่วงนี้
          </p>
          <p className="mt-2 text-2xl font-semibold">{totalClasses}</p>
          <p className="mt-1 text-[11px] text-admin-textMuted">
            นับจากวันที่เริ่ม–วันจบของ Class ที่ทับซ้อนกับช่วงเวลา
          </p>
        </div>

        <div className="rounded-2xl bg-admin-surface p-4 shadow-card">
          <p className="text-xs text-admin-textMuted">
            จำนวนนักเรียน (ลงทะเบียน)
          </p>
          <p className="mt-2 text-2xl font-semibold">{totalStudents}</p>
          <p className="mt-1 text-[11px] text-admin-textMuted">
            รวมทุกคลาสในช่วงเวลาที่เลือก
          </p>
        </div>

        <div className="rounded-2xl bg-admin-surface p-4 shadow-card">
          <p className="text-xs text-admin-textMuted">จำนวนเช็คอิน</p>
          <p className="mt-2 text-2xl font-semibold">{totalCheckins}</p>
          <p className="mt-1 text-[11px] text-admin-textMuted">
            นับจาก collection checkins ตามช่วงเวลา
          </p>
        </div>

        <div className="rounded-2xl bg-admin-surface p-4 shadow-card">
          <p className="text-xs text-admin-textMuted">เช็คอินสาย</p>
          <p className="mt-2 text-2xl font-semibold text-brand-danger">
            {lateCount}
          </p>
          <p className="mt-1 text-[11px] text-admin-textMuted">
            ตรวจจาก flag <code>isLate</code> ใน collection checkins
          </p>
        </div>
      </div>

      {/* Bottom: Chart placeholder + Top menu + Latest checkins */}
      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        {/* (ซ้าย) ภาพรวมคลาสในช่วงนี้ – ตอนนี้เป็นพื้นที่ว่าง เผื่อใส่กราฟในอนาคต */}
        <div className="rounded-2xl bg-admin-surface p-5 shadow-card">
          <h2 className="text-sm font-semibold">
            ภาพรวมคลาสในช่วงนี้
          </h2>
          <p className="mt-1 text-xs text-admin-textMuted">
            ยังไม่มีคลาสในช่วงเวลาที่เลือก
          </p>
          {totalClasses > 0 && (
            <ul className="mt-4 space-y-2 text-sm max-h-64 overflow-y-auto">
              {classes
                .sort(
                  (a, b) =>
                    new Date(a.startDate || a.date) -
                    new Date(b.startDate || b.date)
                )
                .map((c) => (
                  <li
                    key={c._id}
                    className="flex items-center justify-between rounded-xl border border-admin-border px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {c.classCode} – {c.title}
                      </span>
                      <span className="text-[11px] text-admin-textMuted">
                        ห้อง {c.room || "-"}
                      </span>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>

        {/* ขวาบน: เมนูยอดฮิต */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-admin-surface p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                เมนูยอดฮิต (นับตามผู้เรียน)
              </h2>
              <span className="text-[11px] text-admin-textMuted">
                อิงจาก Student.food.menuId
              </span>
            </div>

            {topMenus.length === 0 ? (
              <p className="mt-4 text-sm text-admin-textMuted">
                ยังไม่มีข้อมูลเมนูอาหารในช่วงนี้
              </p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {topMenus.map(([menuId, count]) => (
                  <li
                    key={menuId}
                    className="flex items-center justify-between rounded-xl border border-admin-border px-3 py-2"
                  >
                    <span className="font-medium">{menuId}</span>
                    <span className="text-admin-textMuted">
                      {count} คนเลือก
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ขวาล่าง: เช็คอินล่าสุด */}
          <div className="rounded-2xl bg-admin-surface p-5 shadow-card">
            <h2 className="text-sm font-semibold">เช็คอินล่าสุด</h2>
            <p className="text-[11px] text-admin-textMuted">
              แสดงตัวอย่างข้อมูลจาก collection checkins (สูงสุด 20 รายการ)
            </p>

            {checkins.length === 0 ? (
              <p className="mt-4 text-sm text-admin-textMuted">
                ยังไม่มีการเช็คอินในช่วงนี้
              </p>
            ) : (
              <ul className="mt-4 space-y-2 max-h-64 overflow-y-auto text-sm">
                {checkins
                  .slice()
                  .sort((a, b) => new Date(b.time) - new Date(a.time))
                  .slice(0, 20)
                  .map((c) => (
                    <li
                      key={c._id}
                      className="flex items-center justify-between rounded-xl border border-admin-border px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {c.studentId?.thaiName ||
                            c.studentId?.engName ||
                            "ไม่พบชื่อผู้เรียน"}
                        </span>
                        <span className="text-[11px] text-admin-textMuted">
                          {c.classId
                            ? `${c.classId.classCode} – ${c.classId.title}`
                            : "ไม่พบข้อมูล Class"}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-admin-textMuted">
                          {new Date(c.time).toLocaleTimeString("th-TH", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <span
                          className={
                            "inline-block mt-1 rounded-full px-2 py-0.5 text-[11px] " +
                            (c.isLate
                              ? "bg-brand-danger/10 text-brand-danger"
                              : "bg-brand-success/10 text-brand-success")
                          }
                        >
                          {c.isLate ? "สาย" : "ปกติ"}
                        </span>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
