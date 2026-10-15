"use client";

/**
 * แถบงบคูปอง
 *   ไม่เกินงบ -> น้ำเงิน
 *   เกินงบ    -> ส้ม "ชำระเพิ่มที่ร้าน X บาท" (สั่งเกินได้ ไม่ใช่ข้อผิดพลาด จึงไม่ใช้คำว่า "เกินงบ")
 *
 * คลาสสีทุกตัวเขียนเต็ม ๆ ในไฟล์นี้ (bg-[#2486ff] / bg-[#d98a13]) ไม่ประกอบจาก
 * ตัวแปร มิฉะนั้น Tailwind JIT จะมองไม่เห็นแล้วสีหาย
 */
// slim = หัวหน้าเมนู (พื้นขาว แถบ 6px) / ค่าเริ่มต้น = หน้ารายละเอียดเมนูแบบเดิม
// leading = ของที่วางหน้าข้อความงบในแถวเดียวกัน (ปุ่มกลับของหน้ารายละเอียด) -> พื้นขาว
export default function BudgetBar({ budget, selected, slim = false, leading = null }) {
  const over = selected > budget;
  const remaining = budget - selected;
  const pct = budget > 0 ? Math.min(100, (selected / budget) * 100) : 0;

  const frame = slim
    ? "bg-white pb-2.5 pt-1"
    : leading
      ? "flex items-center gap-3 border-b border-black/[.08] bg-white py-2"
      : "border-b border-black/5 bg-[#f8fafd] py-2.5";

  return (
    <div className={`px-4 ${frame}`}>
      {leading}
      <div className={leading ? "min-w-0 flex-1" : ""}>
        <p
          className={`text-[13px] leading-snug ${over ? "text-[#b8720a]" : "text-[#0d1b2a]"}`}
        >
          {over ? (
            <>
              เลือกแล้ว {selected} บาท ·{" "}
              <span className="font-semibold">ชำระเพิ่มที่ร้าน {selected - budget} บาท</span>
            </>
          ) : (
            <>
              งบคูปอง {budget} บาท · เลือกแล้ว {selected} บาท ·{" "}
              <span className="font-semibold">คงเหลือ {remaining} บาท</span>
            </>
          )}
        </p>

        <div
          className={`mt-1.5 w-full overflow-hidden rounded-full bg-black/10 ${slim ? "h-1.5" : "h-2"}`}
        >
          <div
            data-testid="budget-fill"
            className={`h-full rounded-full transition-all duration-300 ${over ? "bg-[#d98a13]" : "bg-[#2486ff]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
