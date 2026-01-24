// src/app/classroom/checkin/page.jsx
import { Suspense } from "react";
import CheckinClient from "./CheckinClient";

export const dynamic = "force-dynamic"; // กัน prerender ง่ายๆ ด้วย

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CheckinClient />
    </Suspense>
  );
}