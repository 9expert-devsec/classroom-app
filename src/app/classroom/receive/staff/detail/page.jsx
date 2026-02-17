import { Suspense } from "react";
import ReceiveStaffDetailClient from "./ReceiveStaffDetailClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-admin-textMuted">กำลังโหลด...</div>}>
      <ReceiveStaffDetailClient />
    </Suspense>
  );
}
