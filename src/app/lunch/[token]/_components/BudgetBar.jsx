"use client";

/**
 * แถบงบคูปอง
 *   ไม่เกินงบ -> น้ำเงิน
 *   เกินงบ    -> ส้ม พร้อมบอกว่าต้องจ่ายส่วนต่างเองที่ร้าน
 *
 * คลาสสีทุกตัวเขียนเต็ม ๆ ในไฟล์นี้ (bg-[#2486ff] / bg-[#d98a13]) ไม่ประกอบจาก
 * ตัวแปร มิฉะนั้น Tailwind JIT จะมองไม่เห็นแล้วสีหาย
 */
export default function BudgetBar({ budget, selected }) {
  const over = selected > budget;
  const remaining = budget - selected;
  const pct = budget > 0 ? Math.min(100, (selected / budget) * 100) : 0;

  return (
    <div className="border-b border-black/5 bg-[#f8fafd] px-4 py-2.5">
      <p
        className={`text-[13px] leading-snug ${over ? "text-[#b8720a]" : "text-[#0d1b2a]"}`}
      >
        {over ? (
          <>
            เลือกแล้ว {selected} บาท ·{" "}
            <span className="font-semibold">เกินงบ {selected - budget} บาท</span>{" "}
            <span className="text-[12px] text-[#b8720a]/80">
              (ชำระส่วนต่างเองที่ร้าน)
            </span>
          </>
        ) : (
          <>
            งบคูปอง {budget} บาท · เลือกแล้ว {selected} บาท ·{" "}
            <span className="font-semibold">คงเหลือ {remaining} บาท</span>
          </>
        )}
      </p>

      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/10">
        <div
          data-testid="budget-fill"
          className={`h-full rounded-full transition-all duration-300 ${over ? "bg-[#d98a13]" : "bg-[#2486ff]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
