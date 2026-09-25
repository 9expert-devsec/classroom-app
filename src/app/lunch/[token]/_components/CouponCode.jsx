// src/app/lunch/[token]/_components/CouponCode.jsx
//
// แสดงรหัสคูปอง — ตัวเดียวที่ใช้ทุกที่
//   9XP-XXXX            -> แสดงตามเดิม
//   ยาวกว่า 8 ตัวอักษร   -> แบ่งกลุ่มละ 4 ให้อ่านง่าย เช่น 0DDD 4C11 1185 0333 3536
//
// ช่องไฟระหว่างกลุ่มเป็น padding ของ <span> ไม่ใช่ตัวอักษรเว้นวรรค และคั่นด้วย <wbr>
// ให้ตัดบรรทัดได้เฉพาะระหว่างกลุ่ม -> ข้อความใน DOM เป็นรหัสดิบไม่มีช่องว่าง
// เลือก/คัดลอกได้รหัสจริงเสมอ (select-all: แตะครั้งเดียวเลือกทั้งรหัส)
// ขนาดตัวอักษรย่อตามจอแต่ไม่ต่ำกว่า 18px
import { Fragment } from "react";

export function codeGroups(code) {
  const c = String(code || "");
  if (/^9XP-/i.test(c) || c.length <= 8) return [c];
  const out = [];
  for (let i = 0; i < c.length; i += 4) out.push(c.slice(i, i + 4));
  return out;
}

export default function CouponCode({ code, size = "lg" }) {
  const groups = codeGroups(code);
  const multi = groups.length > 1;
  // "table" = ตารางหน้าแอดมิน (P4a) — เล็กและชิดซ้าย; หน้าผู้เรียนยังไม่ต่ำกว่า 18px
  const sizeClass =
    size === "lg"
      ? "text-[clamp(18px,7.5vw,30px)] text-center"
      : size === "table"
        ? "text-[13px] text-left"
        : "text-[clamp(18px,6vw,24px)] text-center";

  return (
    <p
      data-testid="coupon-code"
      title={code}
      className={`select-all font-mono font-bold tabular-nums leading-snug text-[#0d1b2a] ${sizeClass} ${multi ? "tracking-wide" : "tracking-widest"}`}
    >
      {groups.map((g, i) => (
        <Fragment key={i}>
          {i > 0 ? <wbr /> : null}
          <span className={multi ? "px-[0.2em]" : ""}>{g}</span>
        </Fragment>
      ))}
    </p>
  );
}
