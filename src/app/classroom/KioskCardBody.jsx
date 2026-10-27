// src/app/classroom/KioskCardBody.jsx
"use client";

// R5-6 / R5-6a: การ์ดขาวของหน้า kiosk (checkin / masterclass / event / lunch-qr)
//   KioskCardBody : ตัวการ์ด (layout) — ไม่เลื่อนเอง เป็น flex column สูงเต็มการ์ด
//   KioskScroll   : พื้นที่เลื่อนใต้แถบขั้นตอน (หน้าวาง StepHeader ไว้ด้านบน นอกพื้นที่เลื่อน)
//                   scrollbar บาง + เงาจางขอบล่างเมื่อยังมีเนื้อหาด้านล่าง
//   หน้าที่มีรายการเลื่อนของตัวเองอยู่แล้ว (ค้นหาชื่อ / เลือกอาหาร / เซ็น) ใช้ class "kiosk-scrollbar" ที่รายการนั้น
//   -> มีพื้นที่เลื่อนเดียวต่อหน้าเสมอ
import { useEffect, useRef, useState } from "react";

export default function KioskCardBody({ children }) {
  return (
    <main className="min-h-0 flex-1 overflow-hidden rounded-3xl shadow-md">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl bg-front-surface">
        {children}
      </div>
    </main>
  );
}

export function KioskScroll({ children, className = "" }) {
  const ref = useRef(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 2px tolerance: subpixel rounding on tablets
    const update = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 2);
    update();
    el.addEventListener("scroll", update, { passive: true });
    // content height changes (QR loads, step changes) -> re-check
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const observeChildren = () => {
      for (const c of el.children) ro.observe(c);
    };
    observeChildren();
    const mo = new MutationObserver(() => {
      observeChildren();
      update();
    });
    mo.observe(el, { childList: true });
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={ref}
        data-kiosk-scroll=""
        className={`kiosk-scrollbar h-full overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch] ${className}`}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-front-surface to-transparent transition-opacity duration-200 ${
          more ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
