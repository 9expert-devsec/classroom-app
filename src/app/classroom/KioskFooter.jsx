"use client";

// src/app/classroom/KioskFooter.jsx
// L2a: which kiosk this tablet is, and a "close kiosk" button (with confirm).
import { useState } from "react";

export default function KioskFooter({ label, openedByName }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function closeKiosk() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fetch("/api/kiosk/close", { method: "POST" });
    } catch {
      setBusy(false);
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
      return;
    }
    window.location.assign("/classroom/login");
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-admin-border bg-white px-4 py-3 text-xs text-admin-textMuted">
        <div>
          Kiosk: <span className="font-semibold text-admin-text">{label}</span>
          {" · "}เปิดโดย {openedByName || "-"}
          {" · "}หมดอายุ 23:59 น.
        </div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-full border border-admin-border px-3 py-1.5 font-semibold text-admin-text transition hover:bg-admin-surfaceMuted"
        >
          ปิด kiosk
        </button>
      </div>

      {confirming ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="text-base font-semibold text-admin-text">
              ปิด kiosk บนเครื่องนี้?
            </div>
            <p className="mt-2 text-sm text-admin-textMuted">
              เครื่องนี้จะใช้งานหน้างานไม่ได้จนกว่าเจ้าหน้าที่จะเข้าสู่ระบบเปิด kiosk ใหม่
            </p>
            {error ? (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setError("");
                }}
                disabled={busy}
                className="rounded-full border border-admin-border px-4 py-2 text-sm font-semibold text-admin-text hover:bg-admin-surfaceMuted disabled:opacity-60"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={closeKiosk}
                disabled={busy}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {busy ? "กำลังปิด…" : "ปิด kiosk"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
