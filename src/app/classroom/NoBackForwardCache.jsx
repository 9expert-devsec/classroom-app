"use client";

// src/app/classroom/NoBackForwardCache.jsx
// L2b: if the browser restores a /classroom page from its back-forward cache
// (Safari can, even with Cache-Control: no-store), reload it so the server
// checks the kiosk / staff state again instead of showing stale learner data.
import { useEffect } from "react";

export default function NoBackForwardCache() {
  useEffect(() => {
    const onPageShow = (e) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return null;
}
