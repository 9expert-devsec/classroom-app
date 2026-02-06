"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

export default function useCheckinNotifications({ pollMs = 4000 } = {}) {
  const cursorRef = useRef(""); // server cursor
  const seenRef = useRef(new Set());

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        const url = cursorRef.current
          ? `/api/admin/notifications/checkins?since=${encodeURIComponent(
              cursorRef.current,
            )}`
          : `/api/admin/notifications/checkins`;

        const res = await fetch(url, {
          cache: "no-store",
          credentials: "include",
        });

        if (!alive) return;

        const text = await res.text();
        let json = null;

        try {
          json = JSON.parse(text);
        } catch {
          return; // non-json ก็ปล่อยเงียบ
        }

        // ✅ เผื่อเคสที่ response กลายเป็น array
        if (Array.isArray(json)) json = json[0] || null;

        if (!json?.ok) return;

        if (json.cursor) cursorRef.current = json.cursor;

        const items = Array.isArray(json.items) ? json.items : [];
        for (const it of items) {
          const key = it?.eventId || it?.id;
          if (!key || seenRef.current.has(key)) continue;
          seenRef.current.add(key);
          toast.success(it.message || "มีการเช็คอินใหม่");
        }
      } catch {
        // เงียบไว้
      }
    }

    const t = setInterval(tick, pollMs);
    tick();

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pollMs]);
}
