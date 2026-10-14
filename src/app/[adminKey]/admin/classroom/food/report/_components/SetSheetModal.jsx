"use client";

// ใบสั่งร้าน (ร้าน Set) — one day per sheet; this dialog only picks the day when the range has several
import { useState } from "react";

import Modal from "./Modal";
import { formatDateEN } from "./reportUi";

/** @param days [{ dayYMD, count }] days on which this shop has set rows */
export default function SetSheetModal({ shopName, days, onPrint, onClose }) {
  const [dayYMD, setDayYMD] = useState(days[0]?.dayYMD || "");
  return (
    <Modal open title={`พิมพ์ใบสั่งร้าน • ${shopName}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <div className="text-[11px] text-admin-textMuted">วันที่</div>
          <select
            className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-2 text-sm"
            value={dayYMD}
            onChange={(e) => setDayYMD(e.target.value)}
          >
            {days.map((d) => (
              <option key={d.dayYMD} value={d.dayYMD}>
                {formatDateEN(d.dayYMD)} ({d.count} ที่)
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-admin-border bg-white px-3 py-2 text-sm hover:bg-admin-surfaceMuted"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => onPrint(dayYMD)}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            พิมพ์
          </button>
        </div>
      </div>
    </Modal>
  );
}
