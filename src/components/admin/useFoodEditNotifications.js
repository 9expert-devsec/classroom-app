// src/components/admin/useFoodEditNotifications.js
"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

export default function useFoodEditNotifications({ pollMs = 4000 } = {}) {
  const cursorRef = useRef(""); // ISO cursor
  const seenRef = useRef(new Set());
  const timerRef = useRef(null);
  const primedRef = useRef(false);

  useEffect(() => {
    let alive = true;

    async function primeCursor() {
      try {
        const res = await fetch(`/api/admin/notifications/food-edits?prime=1`, {
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json().catch(() => null);

        if (json?.ok && json?.cursor) {
          cursorRef.current = String(json.cursor);
        } else {
          cursorRef.current = new Date().toISOString();
        }
      } catch (e) {
        cursorRef.current = new Date().toISOString();
        console.warn("[useFoodEditNotifications] prime error:", e);
      } finally {
        primedRef.current = true;
      }
    }

    async function tick() {
      try {
        const since = cursorRef.current || new Date().toISOString();
        const url = `/api/admin/notifications/food-edits?since=${encodeURIComponent(
          since,
        )}`;

        const res = await fetch(url, {
          cache: "no-store",
          credentials: "include",
        });

        const json = await res.json().catch(() => null);
        if (!alive || !json?.ok) return;

        const items = Array.isArray(json.items) ? json.items : [];
        for (const it of items) {
          const id = String(it?.id || "");
          if (!id || seenRef.current.has(id)) continue;
          seenRef.current.add(id);

          toast.success(it?.message || "มีการแก้ไขอาหารใหม่");
        }

        if (json.cursor) cursorRef.current = String(json.cursor);
      } catch (e) {
        // เงียบไว้ ไม่ toast error ทุกครั้ง
        console.warn("[useFoodEditNotifications] tick error:", e);
      }
    }

    async function loop() {
      if (!alive) return;

      // prime ครั้งเดียวต่อการ mount รอบนี้
      if (!primedRef.current) await primeCursor();

      await tick();

      // schedule รอบถัดไป (กันหลุด / กันซ้อน)
      timerRef.current = setTimeout(loop, pollMs);
    }

    loop();

    return () => {
      alive = false;
      primedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [pollMs]);
}
