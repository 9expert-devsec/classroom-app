// src/app/classroom/checkin/sign/page.jsx
import { Suspense } from "react";
import CheckinSignClient from "./CheckinSignClient";

export const dynamic = "force-dynamic"; // กัน prerender ง่ายๆ ด้วย

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CheckinSignClient />
    </Suspense>
  );
}
