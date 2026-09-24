"use client";

/**
 * ปุ่ม − / + ของจำนวน (หน้าตาตาม mockup)
 * ต่างจาก mockup: ไม่ต่ำกว่า min และไม่เกิน max — ลดถึง 0 เพื่อลบบรรทัดไม่ได้
 * การลบบรรทัดต้องกดถังขยะเท่านั้น
 */
export default function QtyStepper({ qty, onChange, min = 1, max = 20, size = "md", disabled = false }) {
  const sm = size === "sm";
  const dim = sm ? "h-8 w-8 text-lg" : "h-11 w-11 text-2xl";
  const atMin = qty <= min;
  const atMax = qty >= max;

  return (
    <div className="flex items-center gap-1" data-testid="qty-stepper">
      <button
        type="button"
        onClick={() => !atMin && onChange(qty - 1)}
        disabled={disabled || atMin}
        aria-label="ลด"
        className={`${dim} flex items-center justify-center rounded-xl border border-black/10 bg-white leading-none text-[#0d1b2a] transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-40`}
      >
        −
      </button>
      <span
        data-testid="qty-value"
        className={`${sm ? "w-6" : "w-8"} text-center text-[15px] font-semibold tabular-nums text-[#0d1b2a]`}
      >
        {qty}
      </span>
      <button
        type="button"
        onClick={() => !atMax && onChange(qty + 1)}
        disabled={disabled || atMax}
        aria-label="เพิ่ม"
        className={`${dim} flex items-center justify-center rounded-xl bg-[#2486ff] leading-none text-white transition hover:bg-[#005cff] active:scale-90 disabled:cursor-not-allowed disabled:bg-slate-300`}
      >
        +
      </button>
    </div>
  );
}
