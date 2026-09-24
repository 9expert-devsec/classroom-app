"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import {
  LUNCH_BUDGET_THB,
  ORDER_HARD_CLOSE_HHMM,
} from "@/lib/lunchConfig";

/**
 * Step 3 บนแท็บเล็ต: QR ให้ผู้เรียนสแกนไปสั่งอาหารบนมือถือ
 *
 * เกณฑ์ว่าจะโชว์หรือไม่ ตัดสินที่ server ล้วน ๆ — ถ้าวันนี้ไม่ได้เลือกคูปอง
 * endpoint จะตอบ not_coupon_choice แล้ว component นี้จะไม่ render อะไรเลย
 * (หน้าจอเดิมของตัวเลือกอื่นจึงไม่เปลี่ยน)
 */
export default function LunchQrStep({ studentId, classId, onReady, onDone }) {
  const [state, setState] = useState("loading"); // loading | ready | hidden | error
  const [path, setPath] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!studentId || !classId) {
      setState("hidden");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/checkin/lunch-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, classId }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (res.ok && data?.path) {
          setPath(data.path);
          setState("ready");
          return;
        }

        // ไม่ได้เลือกคูปองวันนี้ = ไม่ต้องมี Step 3 เลย
        if (data?.reason === "not_coupon_choice" || res.status === 409) {
          if (data?.reason === "not_coupon_choice") {
            setState("hidden");
            return;
          }
        }

        setMessage(data?.error || "ออก QR ไม่สำเร็จ");
        setState("error");
      } catch (err) {
        console.error(err);
        if (cancelled) return;
        setMessage("เชื่อมต่อไม่สำเร็จ กรุณาติดต่อเจ้าหน้าที่");
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [studentId, classId]);

  // แจ้ง parent ให้หยุดนับถอยหลังกลับหน้าแรก เมื่อมี Step 3 จริง
  useEffect(() => {
    if (state === "ready" || state === "error") onReady?.();
  }, [state, onReady]);

  if (state === "loading" || state === "hidden") return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = path ? `${origin}${path}` : "";

  return (
    <div className="mt-6 w-full max-w-md rounded-2xl border border-brand-border bg-white p-5 text-center">
      {state === "ready" ? (
        <>
          {/* ใหญ่พอให้สแกนจากระยะแขนบน iPad */}
          <div className="mx-auto flex items-center justify-center rounded-xl bg-white p-4">
            <QRCode value={url} size={280} />
          </div>

          <p className="mt-4 sm:text-xl lg:text-lg font-semibold text-front-text">
            สแกนด้วยมือถือเพื่อสั่งอาหารกลางวัน
          </p>
          <p className="mt-1 sm:text-lg lg:text-base text-front-textMuted">
            งบคูปอง {LUNCH_BUDGET_THB} บาท (ยังไม่รวม VAT ของร้าน)
          </p>
          <p className="mt-1 sm:text-lg lg:text-base text-front-textMuted">
            สั่งได้ถึง {ORDER_HARD_CLOSE_HHMM} น.
          </p>
        </>
      ) : (
        <p className="sm:text-lg lg:text-base text-red-600">{message}</p>
      )}

      <button
        type="button"
        onClick={onDone}
        className="mt-5 w-full rounded-xl bg-brand-primary px-4 py-3 sm:text-xl lg:text-base font-semibold text-[#0D1B2A] hover:opacity-90"
      >
        เสร็จสิ้น
      </button>
    </div>
  );
}
