import { Suspense } from "react";
import ReceiveCustomerSignClient from "./ReceiveCustomerSignClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-admin-textMuted">กำลังโหลด...</div>}>
      <ReceiveCustomerSignClient />
    </Suspense>
  );
}
