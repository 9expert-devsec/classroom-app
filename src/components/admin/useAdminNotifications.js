// src/components/admin/useAdminNotifications.js
"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

function toastByType(type, message) {
  const msg = message || "มีแจ้งเตือนใหม่";
  if (type === "checkin") return toast.success(msg);
  if (type === "receipt") return toast.message(msg);
  if (type === "send") return toast.message(msg);
  if (type === "foodEdit") return toast.message(msg);
  return toast.message(msg);
}

export default function useAdminNotifications({ pollMs = 4000 } = {}) {
  const cursorRef = useRef("");
  const seenRef = useRef(new Set());
  const inflightRef = useRef(false);
  const primedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    let timer = null;

    async function fetchJson(url) {
      const res = await fetch(url, {
        cache: "no-store",
        credentials: "include",
      });
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }

    async function prime() {
      const json = await fetchJson(`/api/admin/notifications/poll?prime=1`);
      if (!alive) return;
      if (Array.isArray(json)) return; // กันเคสแปลกๆ
      if (json?.ok && json.cursor) {
        cursorRef.current = json.cursor;
      } else {
        // fallback: กันพลาด
        cursorRef.current = new Date().toISOString();
      }
      primedRef.current = true;
    }

    async function tick() {
      if (!alive) return;
      if (inflightRef.current) return; // ✅ กันยิงซ้อน
      if (!primedRef.current) return;

      inflightRef.current = true;
      try {
        const url = cursorRef.current
          ? `/api/admin/notifications/poll?since=${encodeURIComponent(cursorRef.current)}`
          : `/api/admin/notifications/poll`;

        const json = await fetchJson(url);
        if (!alive) return;
        if (!json || Array.isArray(json)) return;
        if (!json.ok) return;

        if (json.cursor) cursorRef.current = json.cursor;

        const items = Array.isArray(json.items) ? json.items : [];
        for (const it of items) {
          const key = it?.eventId || it?.id;
          if (!key || seenRef.current.has(key)) continue;
          seenRef.current.add(key);
          toastByType(it.type, it.message);
        }
      } catch {
        // เงียบไว้
      } finally {
        inflightRef.current = false;
      }
    }

    async function loop() {
      await tick();
      if (!alive) return;
      timer = setTimeout(loop, pollMs);
    }

    (async () => {
      await prime(); // ✅ prime ก่อน (กันเด้งของเก่า)
      if (!alive) return;
      await tick(); // ยิงทันที 1 ครั้งหลัง prime
      if (!alive) return;
      timer = setTimeout(loop, pollMs);
    })();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [pollMs]);
}
