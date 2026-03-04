// src/app/coupon/[publicId]/page.jsx
import CouponPublicClient from "./CouponPublicClient";

export const dynamic = "force-dynamic";

export default async function Page(props) {
  const params = await props.params; // กัน Next 16 params เป็น Promise
  return <CouponPublicClient publicId={params?.publicId || ""} />;
}
