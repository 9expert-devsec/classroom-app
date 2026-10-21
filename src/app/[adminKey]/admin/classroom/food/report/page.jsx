// src/app/[adminKey]/admin/classroom/food/report/page.jsx

import FoodReportClient from "./FoodReportClient";
import { toBkkYMD } from "@/lib/lunchConfig";
import { lunchNow } from "@/lib/lunchClock.server";

export const dynamic = "force-dynamic";

// YYYY-MM-DD ตามเวลาไทย — R4-1A: นาฬิกาเดียวกับระบบ lunch (lunchNow) ให้ "วันนี้" ของหน้า
// ตรงกับที่ server ใช้ตัดสินว่าแก้อาหารได้ไหม (production = เวลาจริง)
function getBangkokYMD() {
  return toBkkYMD(lunchNow());
}

export default function Page() {
  // range / shop / tab / filters อยู่ใน URL (FoodReportClient อ่านเอง) — ค่าเริ่มต้น = วันนี้ (Asia/Bangkok)
  return <FoodReportClient todayYMD={getBangkokYMD()} />;
}
