"use client";

// src/app/classroom/StaffAutoLock.jsx
// L2b: coming back to the /classroom menu closes the staff step-up.
// Fire-and-forget - the menu does not wait for or depend on the answer.
import { useEffect } from "react";

export default function StaffAutoLock() {
  useEffect(() => {
    fetch("/api/kiosk/lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "menu" }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  return null;
}
