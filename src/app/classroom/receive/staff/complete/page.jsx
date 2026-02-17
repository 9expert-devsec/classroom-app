import { Suspense } from "react";
import ReceiveStaffCompleteClient from "./ReceiveStaffCompleteClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-admin-textMuted">กำลังโหลด...</div>}>
      <ReceiveStaffCompleteClient />
    </Suspense>
  );
}
