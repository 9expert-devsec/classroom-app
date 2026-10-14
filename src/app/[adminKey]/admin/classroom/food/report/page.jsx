// src/app/[adminKey]/admin/classroom/food/report/page.jsx

import FoodReportClient from "./FoodReportClient";

export const dynamic = "force-dynamic";

function getBangkokYMD() {
  // ให้ได้ YYYY-MM-DD ตามเวลาไทย (กัน server เป็น UTC แล้ววันเพี้ยน)
  const s = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
  }); // en-CA -> YYYY-MM-DD
  return String(s || "").slice(0, 10);
}

export default function Page() {
  // range / shop / tab / filters อยู่ใน URL (FoodReportClient อ่านเอง) — ค่าเริ่มต้น = วันนี้ (Asia/Bangkok)
  return <FoodReportClient todayYMD={getBangkokYMD()} />;
}
