// src/app/classroom/checkin/success/page.jsx
import { Suspense } from "react";
import CheckinSuccessClient from "./CheckinSuccessClient";

export const dynamic = "force-dynamic"; // กัน prerender ง่ายๆ ด้วย

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CheckinSuccessClient />
    </Suspense>
  );
}
