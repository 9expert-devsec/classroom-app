// src/app/admin/classroom/food/report/page.jsx

import FoodReportClient from "./FoodReportClient";

export const dynamic = "force-dynamic";

function getBangkokYMD() {
  // ให้ได้ YYYY-MM-DD ตามเวลาไทย (กัน server เป็น UTC แล้ววันเพี้ยน)
  const s = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
  }); // en-CA -> YYYY-MM-DD
  return String(s || "").slice(0, 10);
}

export default function Page({ searchParams }) {
  const initialDate =
    (searchParams && typeof searchParams.date === "string" && searchParams.date) ||
    getBangkokYMD();

  // ให้ FoodReportClient เป็นคน load เองผ่าน /api/admin/food-orders ตาม date
  return <FoodReportClient initialDate={initialDate} initialOrders={[]} />;
}
