// src/components/admin/AdminNotifications.jsx
"use client";

import useCheckinNotifications from "@/components/admin/useCheckinNotifications";
import useReceiptNotifications from "@/components/admin/useReceiptNotifications";
import useSendNotifications from "@/components/admin/useSendNotifications";
import useFoodEditNotifications from "@/components/admin/useFoodEditNotifications";

export default function AdminNotifications() {
  useCheckinNotifications({ pollMs: 4000 });
  useReceiptNotifications({ pollMs: 4000 });
  useSendNotifications({ pollMs: 4000 });
  useFoodEditNotifications({ pollMs: 4000 });

  return null;
}