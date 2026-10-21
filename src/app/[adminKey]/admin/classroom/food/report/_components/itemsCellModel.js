// src/app/[adminKey]/admin/classroom/food/report/_components/itemsCellModel.js
//
// ข้อมูลของช่อง "รายการอาหาร / ชุด" แบบเรียงซ้อน (r2e) — โครงเดียวกับใบสั่งร้าน (r2a/r2b)
// แยกจาก itemsText / couponLinesText (export / พิมพ์รายคลาส / ค้นหา ยังใช้ตัวเดิม ไม่แตะ)
//
//   blocks: 1 บล็อกต่อ 1 รายการ
//     { qty?, title, subs: [{ label, value }], note }
//       คูปอง: qty× เมนู / "<กลุ่ม>: <ค่า>" ต่อกลุ่ม / หมายเหตุของบรรทัดนั้นเอง (lines[].note)
//       ชุด  : ชื่อชุด / "Add-on: …" / "เครื่องดื่ม: …"
//   trailingNote: หมายเหตุของแถว (row.note = Student.food.note จากตอนเช็คอิน เช่น "COUPON")
//     ไม่ใช่ของบรรทัดไหน -> แสดงแยกเป็นบรรทัดสุดท้ายหลังเส้นคั่น
import { optionGroupsOf } from "@/lib/lunchOptionGroups";

import { addonsOf, rowNote, rowType } from "./reportUi";

export function itemsCellModel(o) {
  const t = rowType(o);
  const blocks = [];

  if (t === "coupon") {
    for (const l of Array.isArray(o?.lines) ? o.lines : []) {
      blocks.push({
        qty: Number(l?.qty) || 1,
        title: l?.name || "-",
        subs: optionGroupsOf(l).map((g) => ({ label: g.group, value: g.values.join(", ") })),
        note: String(l?.note || "").trim(),
      });
    }
  } else if (t === "set") {
    const menuName = o?.menuName || o?.food?.menuName || "";
    const addons = addonsOf(o).filter(Boolean);
    const drink = String(o?.drink ?? o?.food?.drink ?? "").trim();
    if (menuName || addons.length || drink) {
      const subs = [];
      if (addons.length) subs.push({ label: "Add-on", value: addons.join(", ") });
      if (drink) subs.push({ label: "เครื่องดื่ม", value: drink });
      blocks.push({ title: menuName || "-", subs, note: "" });
    }
  }

  return {
    blocks,
    trailingNote: rowNote(o),
  };
}
