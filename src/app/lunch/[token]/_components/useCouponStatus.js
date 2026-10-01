"use client";

// src/app/lunch/[token]/_components/useCouponStatus.js
//
// C2: poll สถานะคูปอง e-coupon ให้หน้าผู้เรียนเปลี่ยนเป็น "ใช้แล้ว" เองระหว่างเปิดค้างไว้
//   - ทุก ~4 วินาที เฉพาะตอน document.visibilityState === "visible"
//   - ซ่อนแท็บ/ล็อกจอ -> หยุด; กลับมา -> เช็คทันที 1 ครั้งแล้ว poll ต่อ
//   - used -> หยุดถาวร; expired -> หยุดถาวร + router.refresh() ให้ด่านตรวจ (C1) พาไปหน้าหมดเวลา
//   - เน็ตล้ม -> poll ต่อแบบถอยเวลา 8 -> 16 -> 30 วิ (เพดาน) ไม่ขึ้น error เต็มจอ
//   - ไม่ใช้ WebSocket / SSE
// ค่าเริ่มต้นมาจาก server render จึงถูกตั้งแต่ paint แรกโดยไม่ต้องรอ poll
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export const POLL_MS = 4000;
// index = จำนวนครั้งที่ล้มติดกัน (0 = ปกติ)
const BACKOFF_MS = [POLL_MS, 8000, 16000, 30000];

function backoffFor(fails) {
  return BACKOFF_MS[Math.min(fails, BACKOFF_MS.length - 1)];
}

export default function useCouponStatus(token, initial) {
  const router = useRouter();
  const initialState = initial?.state || "";
  const [status, setStatus] = useState(() => ({
    state: initialState,
    usedAt: initial?.usedAt || null,
  }));
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    // poll เฉพาะคูปองที่ยังไม่ใช้ — used / expired เป็นสถานะสุดท้าย
    if (!token || initialState !== "unused") return undefined;

    let timer = null;
    let stopped = false;
    let fails = 0;
    let inflight = null;

    const visible = () => document.visibilityState === "visible";

    function clearTimer() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function schedule(ms) {
      clearTimer();
      if (stopped || !visible()) return;
      timer = setTimeout(check, ms);
    }

    async function check() {
      clearTimer();
      if (stopped || !visible() || inflight) return;

      const ctrl = new AbortController();
      inflight = ctrl;
      try {
        const res = await fetch(`/api/lunch/${token}/coupon-status`, {
          cache: "no-store",
          signal: ctrl.signal,
        });

        // token ใช้ไม่ได้แล้ว (ถูกยกเลิก/แทนที่) -> ให้ด่านตรวจฝั่ง server ตัดสิน
        if (res.status === 404 || res.status === 409 || res.status === 410) {
          stopped = true;
          router.refresh();
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        fails = 0;
        setLastUpdated(new Date());
        setStatus({ state: data.state, usedAt: data.usedAt || null });

        if (data.state === "used") {
          stopped = true;
          return;
        }
        if (data.state === "expired") {
          stopped = true;
          router.refresh();
          return;
        }
      } catch (err) {
        if (stopped || err?.name === "AbortError") return;
        fails += 1;
      } finally {
        if (inflight === ctrl) inflight = null;
      }
      schedule(backoffFor(fails));
    }

    function onVisibility() {
      if (visible()) {
        // กลับมาที่หน้า -> เช็คทันทีครั้งเดียว แล้ว check() จะตั้งรอบถัดไปเอง
        if (!stopped && !inflight) check();
      } else {
        clearTimer();
      }
    }

    // ข้อมูลจาก server render ถือว่าเพิ่งอัปเดต — รอบแรกห่าง 4 วินาที
    setLastUpdated(new Date());
    document.addEventListener("visibilitychange", onVisibility);
    schedule(POLL_MS);

    return () => {
      stopped = true;
      clearTimer();
      if (inflight) inflight.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token, initialState, router]);

  return {
    state: status.state,
    usedAt: status.usedAt,
    lastUpdated,
    polling: status.state === "unused",
  };
}
