"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

export default function useReceiptNotifications({ pollMs = 4000 } = {}) {
  const cursorRef = useRef(""); // ISO cursor
  const seenRef = useRef(new Set());
  const warnedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    let timer = null;

    async function primeCursor() {
      try {
        const res = await fetch(`/api/admin/notifications/receipts?prime=1`, {
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json().catch(() => null);

        if (!alive) return;

        if (json?.ok && json?.cursor) cursorRef.current = String(json.cursor);
        else cursorRef.current = new Date().toISOString();
      } catch (e) {
        cursorRef.current = new Date().toISOString();
        if (!warnedRef.current) {
          warnedRef.current = true;
          console.warn("[useReceiptNotifications] prime error:", e);
        }
      }
    }

    async function tick() {
      try {
        const since = cursorRef.current || new Date().toISOString();
        const url = `/api/admin/notifications/receipts?since=${encodeURIComponent(
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
          toast.success(it?.message || "มีการรับเอกสารใหม่");
        }

        if (json.cursor) cursorRef.current = String(json.cursor);
      } catch (e) {
        if (!warnedRef.current) {
          warnedRef.current = true;
          console.warn("[useReceiptNotifications] tick error:", e);
        }
      }
    }

    (async () => {
      await primeCursor();
      await tick();
      timer = setInterval(tick, pollMs);
    })();

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [pollMs]);
}
