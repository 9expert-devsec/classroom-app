"use client";

// src/app/[adminKey]/admin/classroom/food/report/_components/ClassGroupedTable.jsx
//
// "รายละเอียดรายการ" แบบแยกการ์ดตาม Class (r2d) — หน้าตาตามรายงานอาหารเดิม (ก่อน 933739f):
// หัวการ์ด = ชื่อ Class ตัวหนา + "ห้อง <room> • <n> รายการ", ข้างในเป็น ReportTable คอลัมน์เดิม
// จัดกลุ่มหลังกรองแล้ว: แถวที่แสดงในหน้านี้ถูกตัดเป็นการ์ดต่อเนื่องตามลำดับ Class
import ReportTable from "./ReportTable";
import { cleanClassTitle, rowId } from "./reportUi";

export const NO_CLASS_TITLE = "ไม่ระบุ Class";

// key เดียวกับตัวกรอง Class (classOptions / listRows ใน FoodReportClient)
export function classKeyOf(o) {
  return o.classId || o.className || "unknown";
}

/**
 * แถวที่กรองแล้ว -> กลุ่มตาม Class เรียงชื่อ Class (ก-ฮ / A-Z แบบไทย) เหมือนรายงานเดิม
 * แถวที่ไม่มี Class (หรือ Class ไม่มีชื่อ) -> การ์ด "ไม่ระบุ Class" ท้ายสุด
 * @returns [{ key, title, room, rows }]
 */
export function groupRowsByClass(rows) {
  const map = new Map();
  for (const o of rows) {
    const key = classKeyOf(o);
    let g = map.get(key);
    if (!g) {
      const raw = o.className || o.classTitle || "";
      const named = key !== "unknown" && !!raw.trim();
      g = {
        key,
        named,
        title: named ? cleanClassTitle(raw, o.courseCode) : NO_CLASS_TITLE,
        room: o.roomName || "",
        rows: [],
      };
      map.set(key, g);
    }
    g.rows.push(o);
  }
  const named = [...map.values()].filter((g) => g.named);
  const unnamed = [...map.values()].filter((g) => !g.named);
  named.sort((a, b) => a.title.localeCompare(b.title, "th"));
  // Class ที่ไม่มีชื่อหลาย id -> รวมเป็นการ์ด "ไม่ระบุ Class" ใบเดียว
  if (unnamed.length) {
    named.push({
      key: "__no_class",
      named: false,
      title: NO_CLASS_TITLE,
      room: "",
      rows: unnamed.flatMap((g) => g.rows),
    });
  }
  return named;
}

/**
 * @param groups   groupRowsByClass(listRows) — ทั้งชุดที่กรองแล้ว (นับ n รายการ / ลำดับในการ์ด)
 * @param shownIds rowId ของแถวที่อยู่ในหน้านี้ (หลังแบ่งหน้า) — การ์ดที่ไม่มีแถวในหน้านี้ไม่แสดง
 */
export default function ClassGroupedTable({ groups, shownIds, tableProps }) {
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const rows = g.rows.filter((o) => shownIds.has(rowId(o)));
        if (!rows.length) return null;
        // "#" นับใหม่ในแต่ละ Class (ต่อเนื่องถ้า Class เดียวยาวข้ามหน้า)
        const numbers = new Map(g.rows.map((o, i) => [rowId(o), i + 1]));
        return (
          <div
            key={g.key}
            data-testid="class-card"
            className="rounded-2xl border border-admin-border bg-white p-4 shadow-sm"
          >
            <div className="mb-2">
              <div className="text-xs font-semibold text-admin-text">{g.title}</div>
              <div className="text-[11px] text-admin-textMuted">
                {g.room ? <>ห้อง {g.room} • </> : null}
                {g.rows.length} รายการ
              </div>
            </div>
            <ReportTable
              rows={rows}
              numberOf={(o) => numbers.get(rowId(o))}
              selectAllLabel={`เลือกทั้งหมดใน ${g.title}`}
              {...tableProps}
            />
          </div>
        );
      })}
    </div>
  );
}
