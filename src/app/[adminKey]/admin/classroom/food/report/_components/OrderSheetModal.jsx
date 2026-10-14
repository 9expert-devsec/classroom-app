"use client";

// C5d: ใบสั่งร้าน — same builder + same "last printed" memory as before; one day per sheet.
// When the report range has several days, the day is picked here (default: the first day with orders).
import { useState } from "react";

import Modal from "./Modal";
import { buildOrderSheetHtml, orderSheetStorageKey, isHHMM } from "../orderSheetHtml";
import { formatDateEN } from "./reportUi";

function readLastPrinted(dateYMD, shopId) {
  try {
    const v = window.localStorage.getItem(orderSheetStorageKey(dateYMD, shopId)) || "";
    return isHHMM(v) ? v : "";
  } catch {
    return ""; // storage ใช้ไม่ได้ก็ไม่เป็นไร
  }
}

/**
 * @param days      [{ dayYMD, shops }] — only days that have coupon shops
 * @param rowsByDay Map(dayYMD → all rows of that day, unfiltered)
 */
export default function OrderSheetModal({ days, rowsByDay, initialDay, initialShopId, onClose, openAndPrint }) {
  const [dayYMD, setDayYMD] = useState(initialDay);
  const [shopId, setShopId] = useState(initialShopId);
  const [after, setAfter] = useState(() => readLastPrinted(initialDay, initialShopId));
  const [lastDefault, setLastDefault] = useState(() => readLastPrinted(initialDay, initialShopId));

  const shops = days.find((d) => d.dayYMD === dayYMD)?.shops || [];

  function changeTarget(nextDay, nextShop) {
    const def = readLastPrinted(nextDay, nextShop);
    setDayYMD(nextDay);
    setShopId(nextShop);
    setAfter(def);
    setLastDefault(def);
  }

  function print() {
    const afterHHMM = String(after || "").trim();
    if (afterHHMM && !isHHMM(afterHHMM)) return alert("รูปแบบเวลาไม่ถูกต้อง (HH:mm)");

    const printedAt = new Date();
    const { html, printedShopIds } = buildOrderSheetHtml({
      rows: rowsByDay.get(dayYMD) || [], // ทั้งวัน ไม่ขึ้นกับ filter ของตาราง
      shops,
      dateYMD: dayYMD,
      shopId,
      afterHHMM,
      printedAt,
      origin: window.location.origin,
    });

    if (!openAndPrint(html)) return alert("เปิดหน้าต่างพิมพ์ไม่ได้ (ตรวจสอบ pop-up blocker)");

    // จำเวลาที่พิมพ์ (ต่อวัน + ร้าน) เป็นค่าเริ่มต้นของ "เฉพาะออร์เดอร์หลังเวลา" ครั้งถัดไป
    const hhmm = printedAt.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Bangkok",
    });
    const keys = shopId === "all" ? ["all", ...printedShopIds] : [shopId];
    try {
      keys.forEach((k) => window.localStorage.setItem(orderSheetStorageKey(dayYMD, k), hhmm));
    } catch {
      // ignore
    }
    onClose();
  }

  return (
    <Modal open title={`พิมพ์ใบสั่งร้าน • ${formatDateEN(dayYMD)}`} onClose={onClose}>
      <div className="space-y-4">
        {days.length > 1 && (
          <div>
            <div className="text-[11px] text-admin-textMuted">วันที่</div>
            <select
              className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-2 text-sm"
              value={dayYMD}
              onChange={(e) => {
                const nextDay = e.target.value;
                const nextShops = days.find((d) => d.dayYMD === nextDay)?.shops || [];
                changeTarget(nextDay, nextShops.some((s) => s.id === shopId) ? shopId : "all");
              }}
            >
              {days.map((d) => (
                <option key={d.dayYMD} value={d.dayYMD}>
                  {formatDateEN(d.dayYMD)} ({d.shops.length} ร้าน)
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <div className="text-[11px] text-admin-textMuted">ร้าน</div>
          <select
            className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-2 text-sm"
            value={shopId}
            onChange={(e) => changeTarget(dayYMD, e.target.value)}
          >
            <option value="all">ทุกร้านที่มีออร์เดอร์ ({shops.length})</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name || "-"}
                {shop.source === "stock" ? " (Stock)" : " (E-coupon)"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="text-[11px] text-admin-textMuted">เฉพาะออร์เดอร์หลังเวลา (ว่าง = ทั้งหมด)</div>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="time"
              className="rounded-lg border border-admin-border bg-white px-2 py-2 text-sm"
              value={after}
              onChange={(e) => setAfter(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setAfter("")}
              disabled={!after}
              className="rounded-full border border-admin-border px-3 py-1 text-[11px] hover:bg-admin-surfaceMuted disabled:opacity-40"
            >
              ล้าง (พิมพ์ทั้งหมด)
            </button>
          </div>
          <div className="mt-1 text-[11px] text-admin-textMuted">
            {lastDefault
              ? `ค่าเริ่มต้น = เวลาที่พิมพ์ครั้งล่าสุดในเครื่องนี้ (${lastDefault} น.)`
              : "ยังไม่เคยพิมพ์ใบสั่งของวัน/ร้านนี้ในเครื่องนี้"}
          </div>
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
            onClick={print}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            พิมพ์
          </button>
        </div>
      </div>
    </Modal>
  );
}
