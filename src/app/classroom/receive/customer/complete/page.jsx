import { Suspense } from "react";
import ReceiveCustomerCompleteClient from "./ReceiveCustomerCompleteClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-admin-textMuted">กำลังโหลด...</div>}>
      <ReceiveCustomerCompleteClient />
    </Suspense>
  );
}
