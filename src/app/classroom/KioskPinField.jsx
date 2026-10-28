"use client";

// src/app/classroom/KioskPinField.jsx
// PIN-P2b: shared by the kiosk login page and the StaffGate unlock panel.
//   AuthTabs  - "PIN" | "User/Pass" (callers start on PIN every time, nothing remembered)
//   PinInput  - one masked 6-digit field, auto-submits on the 6th digit
//   pinErrorText - Thai message for the PIN routes' reasons
import { useEffect, useRef } from "react";

export const PIN_LENGTH = 6;

export function AuthTabs({ tab, onChange, disabled }) {
  const items = [
    { key: "pin", label: "PIN" },
    { key: "password", label: "User/Pass" },
  ];
  return (
    <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl bg-admin-surfaceMuted p-1">
      {items.map((it) => {
        const active = tab === it.key;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`auth-tab-${it.key}`}
            disabled={disabled}
            onClick={() => onChange(it.key)}
            className={`rounded-xl px-4 py-2.5 text-base font-semibold transition disabled:opacity-60 ${
              active ? "bg-white text-admin-text shadow-sm" : "text-front-textMuted hover:text-admin-text"
            }`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * value/onChange are digits only. onComplete(pin) fires once the 6th digit is typed.
 * `focusKey` changes -> focus again (e.g. after a wrong PIN clears the field).
 */
export function PinInput({ value, onChange, onComplete, disabled, focusKey = 0 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled, focusKey]);

  return (
    <input
      ref={ref}
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      autoFocus
      maxLength={PIN_LENGTH}
      aria-label="PIN 6 หลัก"
      data-testid="pin-input"
      placeholder="••••••"
      disabled={disabled}
      value={value}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH);
        onChange(digits);
        if (digits.length === PIN_LENGTH && value.length < PIN_LENGTH) onComplete?.(digits);
      }}
      className="h-16 w-full rounded-2xl border border-admin-border bg-white px-4 text-center font-mono text-3xl tracking-[0.5em] outline-none transition placeholder:text-admin-border focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60"
    />
  );
}

/** Thai message for a PIN route response, or "" when the reason is not a PIN one. */
export function pinErrorText(data) {
  switch (data?.reason) {
    case "bad_pin": {
      const left = Number(data.remaining);
      return Number.isFinite(left) && left > 0
        ? `PIN ไม่ถูกต้อง (ลองได้อีก ${left} ครั้ง)`
        : "PIN ไม่ถูกต้อง";
    }
    case "pin_locked": {
      const mins = Math.max(1, Math.ceil(Number(data.retryAfter || 0) / 60));
      return `ใส่ PIN ผิดหลายครั้ง — ล็อกไว้ ลองใหม่ได้ในอีก ${mins} นาที`;
    }
    case "pin_unavailable":
      return "ใช้ PIN ไม่ได้ในขณะนี้ กรุณาใช้ Username/Password";
    default:
      return "";
  }
}
