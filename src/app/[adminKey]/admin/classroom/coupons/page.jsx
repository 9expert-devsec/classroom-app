// src/app/[adminKey]/admin/classroom/coupons/page.jsx
//
// r3a: เลิกใช้หน้า "Coupon Tracking" — URL เดิม (bookmark) พากลับหน้าแรกของแอดมิน
// หน้าจอเดิมยังอยู่ใน CouponsClient.jsx (ไม่ได้ใช้) เผื่อย้อนกลับด้วย revert commit เดียว
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page(props) {
  const params = await props.params; // Next 16 params เป็น Promise
  redirect(`/${params?.adminKey || ""}/admin/classroom`);
}
