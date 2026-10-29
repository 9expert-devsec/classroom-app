"use client";

// src/app/lunch/[token]/_components/FlowGuard.jsx
//
// กันผู้เรียนย้อนกลับเข้าหน้าสั่งอาหาร (ชื่อเล่น/เลือกร้าน/เมนู/รายละเอียด/สรุป) หลังสั่งแล้ว
// ด่าน server (loadLunchGate) ทำงานเฉพาะตอนมี request — back/forward ของ Next ใช้ router cache
// และเบราว์เซอร์ใช้ bfcache โดยไม่ถาม server จึงต้องเช็คซ้ำฝั่ง client:
//   - mount จาก cache (renderId ที่เคยเห็นแล้ว) หลัง back/forward หรือเครื่องนี้เคยเห็นหน้าคูปองของ token นี้
//       -> ยังไม่แสดงอะไรจนกว่าเช็คผ่าน
//   - pageshow (persisted = กลับมาจาก bfcache) -> ซ่อน + เช็ค
//   - visibilitychange กลับมาเห็นหน้า -> เช็คเบื้องหลัง
//   สั่งแล้ว/ปิดแล้ว -> window.location.replace(/lunch/<token>) (ไม่เพิ่ม history, ข้าม router cache)
// render แรกจาก server (renderId ใหม่) แสดงทันที — server เพิ่งตรวจมาแล้ว
// ใบที่ออก QR ใหม่ (ยกเลิก + ออกใหม่) เป็น token ใหม่ จึงไม่โดนกันจาก token เดิม
import { useEffect, useState } from "react";

const POP_WINDOW_MS = 1500;
const seenRenders = new Set();
let lastPopAt = 0;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    lastPopAt = Date.now();
  });
}

export function placedFlagKey(token) {
  return `lunch.placed.${token}`;
}

function knownPlaced(token) {
  try {
    return window.localStorage.getItem(placedFlagKey(token)) === "1";
  } catch {
    return false;
  }
}

function shouldHoldOnMount(token, renderId) {
  if (typeof window === "undefined" || !seenRenders.has(renderId)) return false;
  return knownPlaced(token) || Date.now() - lastPopAt < POP_WINDOW_MS;
}

export default function FlowGuard({ token, renderId, children }) {
  const [held, setHeld] = useState(() => shouldHoldOnMount(token, renderId));

  useEffect(() => {
    let cancelled = false;
    const home = `/lunch/${token}`;

    function leave() {
      cancelled = true;
      window.location.replace(home);
    }

    async function check({ hold }) {
      if (hold) setHeld(true);
      if (knownPlaced(token)) {
        leave();
        return;
      }
      try {
        const res = await fetch(`/api/lunch/${token}/flow-state`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.open === false) {
          leave();
          return;
        }
      } catch {
        // เน็ตล้ม -> ไม่ค้างจอว่าง ด่าน server ยังกันตอนเปลี่ยนหน้า/ส่งออเดอร์
      }
      if (!cancelled) setHeld(false);
    }

    const holdNow = shouldHoldOnMount(token, renderId);
    seenRenders.add(renderId);
    if (holdNow) check({ hold: true });

    function onPageShow(e) {
      if (e.persisted) check({ hold: true });
    }
    function onVisibility() {
      if (document.visibilityState === "visible") check({ hold: false });
    }
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token, renderId]);

  return held ? null : children;
}
