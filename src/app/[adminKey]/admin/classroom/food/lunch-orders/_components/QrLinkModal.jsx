"use client";

// R2a-2: QR ของออเดอร์ (ดู QR / หลัง Regenerate / ยกเลิกเพื่อแก้ไข / ออก QR ใหม่)
// ใช้ลิงก์เต็มจาก server (qrUrl = base URL ที่ตั้งไว้) — ไม่เอา origin ของหน้าแอดมินมาต่อ
// เพื่อให้มือถือผู้เรียนเปิดได้แม้แอดมินเปิดหน้านี้จาก localhost
import { useState } from "react";
import { Copy, ExternalLink } from "lucide-react";

import LunchQrCode from "@/components/shared/LunchQrCode";
import { Modal, hmBkk } from "@/components/admin/lunch/LunchModals";
import { StatusPill } from "./lunchOrdersUi";

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // http (ไม่ใช่ https) บางเครื่องไม่มี clipboard API
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * qr = { title, url, name, nickname, className, room, status, deadlineAt, finalLabel }
 *   finalLabel = เวลาปิดที่ใช้จริงจาก server (R3x-3)
 */
export default function QrLinkModal({ qr, onClose }) {
  const [copied, setCopied] = useState("");

  async function onCopy() {
    const ok = await copyText(qr.url);
    setCopied(ok ? "คัดลอกลิงก์แล้ว" : "คัดลอกไม่สำเร็จ");
  }

  const classLine = [qr.className, qr.room ? `ห้อง ${qr.room}` : ""].filter(Boolean).join(" · ");

  return (
    <Modal onClose={onClose} testId="qr-modal" wide>
      <h3 className="pr-8 text-base font-semibold text-admin-text">{qr.title}</h3>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-admin-text">
            {qr.name || "-"}
            {qr.nickname ? <span className="text-admin-textMuted"> ({qr.nickname})</span> : null}
          </div>
          {classLine ? (
            <div className="truncate text-xs text-admin-textMuted">{classLine}</div>
          ) : null}
        </div>
        {qr.status ? <StatusPill status={qr.status} /> : null}
      </div>

      <div className="mt-4">
        <LunchQrCode url={qr.url} size={300} />
      </div>

      {qr.deadlineAt ? (
        <p className="mt-3 text-center text-sm text-admin-text">
          สแกนด้วยมือถือเพื่อสั่งอาหาร · ส่งก่อน{" "}
          <span className="font-semibold tabular-nums">{hmBkk(qr.deadlineAt)} น.</span>
        </p>
      ) : null}
      {qr.status === "forfeited" ? (
        <p className="mt-1 text-center text-xs text-admin-textMuted">
          หมดเวลา {qr.finalLabel || "15:00"} แล้ว — ลิงก์นี้จะเปิดหน้าหมดเวลา
        </p>
      ) : null}

      <p className="mt-2 break-all text-center text-[11px] text-admin-textMuted" data-testid="qr-url">
        {qr.url}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {copied ? <span className="mr-auto text-xs text-admin-textMuted">{copied}</span> : null}
        <a
          href={qr.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-admin-border px-4 py-2 text-sm text-admin-text hover:bg-admin-surfaceMuted"
        >
          <ExternalLink className="h-4 w-4" />
          เปิดลิงก์
        </a>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-admin-border px-4 py-2 text-sm text-admin-text hover:bg-admin-surfaceMuted"
        >
          <Copy className="h-4 w-4" />
          คัดลอกลิงก์
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-[#0D1B2A] hover:opacity-90"
        >
          ปิด
        </button>
      </div>
    </Modal>
  );
}
