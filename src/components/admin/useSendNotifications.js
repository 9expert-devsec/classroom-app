// src/components/admin/useSendNotifications.js
"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

export default function useSendNotifications({ pollMs = 4000 } = {}) {
  const cursorRef = useRef(""); // ISO cursor
  const seenRef = useRef(new Set());
  const warnedRef = useRef(false);

  useEffect(() => {
    let alive = true;

    async function primeCursor() {
      try {
        const res = await fetch(`/api/admin/notifications/sends?prime=1`, {
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json().catch(() => null);
        cursorRef.current =
          json?.ok && json?.cursor
            ? String(json.cursor)
            : new Date().toISOString();
      } catch (e) {
        cursorRef.current = new Date().toISOString();
        if (!warnedRef.current) {
          warnedRef.current = true;
          console.warn("[useSendNotifications] prime error:", e);
        }
      }
    }

    async function tick() {
      try {
        const url = `/api/admin/notifications/sends?since=${encodeURIComponent(
          cursorRef.current || new Date().toISOString(),
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
          toast.success(it?.message || "มีการส่งเอกสารใหม่");
        }

        if (json.cursor) cursorRef.current = String(json.cursor);
      } catch (e) {
        if (!warnedRef.current) {
          warnedRef.current = true;
          console.warn("[useSendNotifications] tick error:", e);
        }
      }
    }

    (async () => {
      await primeCursor();
      await tick();
    })();

    const t = setInterval(() => tick(), pollMs);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pollMs]);
}
