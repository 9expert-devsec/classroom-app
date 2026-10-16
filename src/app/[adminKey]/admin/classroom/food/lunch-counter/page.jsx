// src/app/[adminKey]/admin/classroom/food/lunch-counter/page.jsx
//
// r3a: เลิกใช้หน้า "Counter คูปองอาหาร" — URL เดิม (bookmark) พากลับหน้าแรกของแอดมิน
// หน้าจอเดิมยังอยู่ใน LunchCounterClient.jsx (ไม่ได้ใช้) เผื่อย้อนกลับด้วย revert commit เดียว
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page(props) {
  const params = await props.params;
  redirect(`/${params?.adminKey || ""}/admin/classroom`);
}
