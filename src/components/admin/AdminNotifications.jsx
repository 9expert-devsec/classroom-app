// src/components/admin/AdminNotifications.jsx
"use client";

import useAdminNotifications from "@/components/admin/useAdminNotifications";

export default function AdminNotifications() {
  useAdminNotifications({ pollMs: 4000 });
  return null;
}
