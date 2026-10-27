"use client";

// src/app/[adminKey]/admin/classroom/food/report/_components/ClassGroupedTable.jsx
//
// "รายละเอียดรายการ" แบบแยกการ์ดตาม Class (r2d) — หน้าตาตามรายงานอาหารเดิม (ก่อน 933739f):
// หัวการ์ด = ชื่อ Class ตัวหนา + "ห้อง <room> • <n> รายการ", ข้างในเป็น ReportTable คอลัมน์เดิม
// จัดกลุ่มหลังกรองแล้ว: แถวที่แสดงในหน้านี้ถูกตัดเป็นการ์ดต่อเนื่องตามลำดับ Class
// R4-2: ในแต่ละ Class แยกเป็นหัวข้อย่อยตามวัน (เรียงวันที่จากเก่าไปใหม่ พับได้ เปิดไว้ก่อน)
//       หัวข้อวันบอกวันที่ — ตารางข้างในไม่มีคอลัมน์วันที่ · เลข # นับใหม่ทุกวัน
import { useState } from "react";
import { ChevronDown } from "lucide-react";

import ReportTable from "./ReportTable";
import { cleanClassTitle, cx, dayHeaderLabel, formatDateDMY, rowId, rowType } from "./reportUi";

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
        courseCode: o.courseCode || "",
        rows: [],
      };
      map.set(key, g);
    }
    g.rows.push(o);
  }
  // R4-2: แถวในการ์ดเรียงตามวัน (คงลำดับเดิมภายในวันเดียวกัน) — การแบ่งหน้าตัดตามลำดับนี้
  for (const g of map.values()) {
    g.rows = g.rows
      .map((o, i) => ({ o, i }))
      .sort((a, b) => String(a.o.dayYMD || "").localeCompare(String(b.o.dayYMD || "")) || a.i - b.i)
      .map((x) => x.o);
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

/** แถวของ Class -> กลุ่มตามวัน (เรียงวันที่จากเก่าไปใหม่) [{ dayYMD, day, classDayCount, rows }] */
function groupRowsByDay(rows) {
  const map = new Map();
  for (const o of rows) {
    const k = String(o.dayYMD || "");
    if (!map.has(k)) {
      map.set(k, {
        dayYMD: k,
        day: o.day || null,
        classDayCount: o.classDayCount || null,
        classKey: classKeyOf(o), // R6-1: key ของ dayStats
        rows: [],
      });
    }
    map.get(k).rows.push(o);
  }
  return [...map.values()].sort((a, b) => a.dayYMD.localeCompare(b.dayYMD));
}

/**
 * R6-1: "เช็คอิน a/b คน · Set x · คูปอง y · ไม่รับอาหาร z" (+ ยังไม่เลือก / ไม่มีข้อมูล เมื่อมี)
 *   stats = ทั้งวันของคลาส (ไม่ขึ้นกับตัวกรอง) · ไม่มี stats = นับจากแถวที่ส่งมา
 *   b = ผู้เรียนในห้องของคลาส ("-" เมื่อ server ไม่รู้ — ออเดอร์ของคลาสที่วันนั้นไม่ใช่วันเรียน)
 */
function dayCountsLine(rows, stats) {
  const n = stats || { checkedIn: rows.length, learners: null, set: 0, coupon: 0, none: 0, not_chosen: 0, no_data: 0 };
  if (!stats) for (const o of rows) n[rowType(o)] = (n[rowType(o)] || 0) + 1;
  return [
    `เช็คอิน ${n.checkedIn}/${n.learners ?? "-"} คน`,
    `Set ${n.set}`,
    `คูปอง ${n.coupon}`,
    `ไม่รับอาหาร ${n.none}`,
    n.not_chosen ? `ยังไม่เลือก ${n.not_chosen}` : "",
    n.no_data ? `ไม่มีข้อมูล ${n.no_data}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** หัวข้อย่อยของวัน (พับได้ เปิดไว้ก่อน — การพับเป็นแค่สถานะของมุมมองนี้ ไม่จำข้ามการโหลดใหม่) + ตารางของวันนั้น */
function DaySection({ dayGroup, tableProps, classTitle, stats }) {
  const [open, setOpen] = useState(true);
  // "#" นับใหม่ทุกวัน
  const numbers = new Map(dayGroup.rows.map((o, i) => [rowId(o), i + 1]));
  return (
    <div data-testid="day-section" className="rounded-xl border border-admin-border/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left hover:bg-admin-surfaceMuted/50"
      >
        <ChevronDown className={cx("h-4 w-4 shrink-0 text-admin-textMuted transition-transform", !open && "-rotate-90")} />
        <span className="text-xs font-semibold text-admin-text">{dayHeaderLabel(dayGroup)}</span>
        <span className="text-[11px] text-admin-textMuted" data-testid="day-counts">
          {dayCountsLine(dayGroup.rows, stats)}
          {/* ตัวกรองเหลือบางแถว -> บอกจำนวนที่แสดง */}
          {stats && dayGroup.rows.length < stats.checkedIn ? ` · แสดง ${dayGroup.rows.length} รายการ` : ""}
        </span>
      </button>
      {open && (
        <div className="px-2 pb-2">
          <ReportTable
            rows={dayGroup.rows}
            numberOf={(o) => numbers.get(rowId(o))}
            selectAllLabel={`เลือกทั้งหมดใน ${classTitle} วันที่ ${formatDateDMY(dayGroup.dayYMD)}`}
            showDate={false}
            {...tableProps}
          />
        </div>
      )}
    </div>
  );
}

/**
 * @param groups คลาสของหน้านี้ (groupRowsByClass หลังกรอง แล้วตัดตามหน้า) — R4-3: ทุกแถวของคลาส
 *               ไม่ถูกตัดกลางคลาส/วันแล้ว · คลาส/วันที่ไม่มีแถวหลังกรองไม่ปรากฏอยู่แล้ว
 */
// R4-3: viewKey = ช่วงวัน + ตัวกรอง + หน้า — ใช้เป็นส่วนหนึ่งของ key ของหัวข้อวัน
//        เดิม key = วันอย่างเดียว: คลาสที่ยังอยู่บนจอหลังเปลี่ยนหน้า/ตัวกรอง/ช่วงวันใช้ instance เดิม
//        สถานะ "พับ" ที่ผู้ใช้กดไว้จึงติดมาด้วย -> ตอนนี้ทุกครั้งที่มุมมองเปลี่ยน หัวข้อวันเริ่มเปิดใหม่หมด
// R6-1: dayStats = Map("<classKey>|<dayYMD>" -> นับทั้งวัน) จาก FoodReportClient (หัวข้อวัน)
export default function ClassGroupedTable({ groups, tableProps, viewKey = "", dayStats = null }) {
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        if (!g.rows.length) return null;
        const dayGroups = groupRowsByDay(g.rows);
        return (
          <div
            key={g.key}
            data-testid="class-card"
            className="rounded-2xl border border-admin-border bg-white p-4 shadow-sm"
          >
            <div className="mb-2">
              <div className="text-xs font-semibold text-admin-text">
                {g.courseCode ? <span className="text-admin-textMuted">{g.courseCode} · </span> : null}
                {g.title}
              </div>
              <div className="text-[11px] text-admin-textMuted">
                {g.room ? <>ห้อง {g.room} · </> : null}
                {g.rows.length} รายการ
              </div>
            </div>
            <div className="space-y-2">
              {dayGroups.map((dg) => (
                <DaySection
                  key={`${dg.dayYMD}|${viewKey}`}
                  dayGroup={dg}
                  tableProps={tableProps}
                  classTitle={g.title}
                  stats={dayStats?.get(`${dg.classKey}|${dg.dayYMD}`) || null}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
