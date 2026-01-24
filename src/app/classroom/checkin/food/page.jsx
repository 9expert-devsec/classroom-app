// src/app/classroom/checkin/food/page.jsx
import { Suspense } from "react";
import CheckinFoodClient from "./CheckinFoodClient";

export const dynamic = "force-dynamic"; // กัน prerender ง่ายๆ ด้วย

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CheckinFoodClient />
    </Suspense>
  );
}
