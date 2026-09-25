"use client";

// โมดัลของหน้าแอดมินอาหารกลางวัน — ใช้ร่วมกันระหว่าง "ติดตามการสั่งอาหาร" และ "Counter"
// (ย้ายออกมาจากหน้า P4a โดยไม่เปลี่ยนหน้าตา)
import { X } from "lucide-react";
import LunchQrCode from "@/components/shared/LunchQrCode";

export function hmBkk(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

export function Modal({ children, onClose, testId, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        data-testid={testId}
        className={`relative w-full rounded-2xl bg-white p-5 shadow-xl ${wide ? "max-w-lg" : "max-w-md"}`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-admin-textMuted hover:bg-admin-surfaceMuted"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

/** QR หลังเปิดพิเศษ / ออก QR ใหม่ ให้เจ้าหน้าที่หันจอให้ผู้เรียนสแกน */
export function QrModal({ qr, onClose }) {
  return (
    <Modal onClose={onClose} testId="qr-modal">
      <h3 className="pr-8 text-base font-semibold text-admin-text">{qr.title}</h3>
      <p className="mt-1 text-sm text-admin-textMuted">{qr.name}</p>
      <div className="mt-4">
        <LunchQrCode path={qr.path} size={260} />
      </div>
      <p className="mt-3 text-center text-sm text-admin-text">
        สแกนด้วยมือถือเพื่อสั่งอาหาร · สั่งได้ถึง{" "}
        <span className="font-semibold">{hmBkk(qr.deadlineAt)} น.</span>
      </p>
      <p className="mt-1 text-center text-xs text-admin-textMuted">
        หรือให้ผู้เรียนเปิดจากเมนูบน tablet
      </p>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-admin-border px-4 py-2 text-sm text-admin-text hover:bg-admin-surfaceMuted"
        >
          ปิด
        </button>
      </div>
    </Modal>
  );
}

/** ยืนยันก่อนทำรายการ (ส่งมอบ / รับคืน) */
export function ConfirmModal({
  title,
  children,
  confirmLabel,
  busyLabel = "กำลังบันทึก…",
  busy,
  error,
  onClose,
  onConfirm,
  testId = "confirm-modal",
}) {
  return (
    <Modal onClose={onClose} testId={testId} wide>
      <h3 className="pr-8 text-lg font-semibold text-admin-text">{title}</h3>
      <div className="mt-3">{children}</div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-xl border border-admin-border px-5 py-2.5 text-sm text-admin-text hover:bg-admin-surfaceMuted disabled:opacity-50"
        >
          ปิด
        </button>
        <button
          type="button"
          data-testid="confirm-ok"
          onClick={onConfirm}
          disabled={busy}
          className="rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-[#0D1B2A] hover:opacity-90 disabled:opacity-50"
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
