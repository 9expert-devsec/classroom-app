// src/app/coupon/[publicId]/page.jsx
//
// C3e: หน้าคูปองสาธารณะเดิม (CouponRecord) เลิกใช้แล้ว -> 404
// e-coupon ตัวใหม่อยู่ที่ /lunch/[token] (LunchOrder) — โค้ดเดิมเก็บไว้ข้างล่างเป็น comment
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default function RetiredCouponPage() {
  notFound();
}

/* ---- ของเดิม (ก่อน C3e) /coupon/[publicId] ---- */
// // src/app/coupon/[publicId]/page.jsx
// import CouponPublicClient from "./CouponPublicClient";
//
// export const dynamic = "force-dynamic";
//
// export default async function Page(props) {
//   const params = await props.params; // กัน Next 16 params เป็น Promise
//   return <CouponPublicClient publicId={params?.publicId || ""} />;
// }
