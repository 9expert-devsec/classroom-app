// src/app/m/scan/page.jsx
//
// C3b: ระบบ Merchant เดิม (CouponRecord + login) เลิกใช้แล้ว -> 404
// Merchant ตัวใหม่อยู่ที่ /m/[key] (ทำงานบน LunchOrder) — โค้ดเดิมเก็บไว้ข้างล่างเป็น comment
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default function RetiredMerchantPage() {
  notFound();
}

/* ---- ของเดิม (ก่อน C3b) ---- */
// // src/app/m/scan/page.jsx
// import ScanClient from "./ScanClient";
//
// export const dynamic = "force-dynamic";
//
// export default function Page() {
//   return <ScanClient />;
// }
