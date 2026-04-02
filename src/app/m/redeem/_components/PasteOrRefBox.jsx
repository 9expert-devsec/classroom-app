"use client";

import { useState } from "react";

function clean(x) {
  return String(x ?? "").trim();
}

export default function PasteOrRefBox({ disabled, onAdd }) {
  const [text, setText] = useState("");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-bold">วางลิงก์ / Ref (สำรอง)</div>
      <div className="mt-1 text-xs text-slate-500">
        วางลิงก์ /m/redeem?c=..., วางลิงก์ /coupon/... หรือพิมพ์ Ref เช่น
        9XP4364
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[#66CCFF] focus:ring-2 focus:ring-[#66CCFF]/60"
          placeholder="วางลิงก์หรือ Ref"
          disabled={disabled}
        />

        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const value = clean(text);
            if (!value) return;
            onAdd?.(value);
            setText("");
          }}
          className="rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
        >
          เพิ่ม
        </button>
      </div>
    </div>
  );
}