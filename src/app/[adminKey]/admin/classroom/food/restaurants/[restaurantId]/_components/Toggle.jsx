"use client";

// สวิตช์เปิด/ปิดเล็ก ๆ ใช้ร่วมกันในหน้าจัดการร้าน
export default function Toggle({
  checked = false,
  onChange,
  disabled = false,
  label = "",
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label || undefined}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={[
        "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition",
        checked ? "bg-brand-primary" : "bg-admin-border",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
          checked ? "translate-x-5" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}
