// src/app/[adminKey]/admin/classroom/coupons/page.jsx
import CouponsClient from "./CouponsClient";

export const dynamic = "force-dynamic";

export default async function Page(props) {
  const params = await props.params; // Next 16 params เป็น Promise
  const adminKey = params?.adminKey || "";
  return <CouponsClient adminKey={adminKey} />;
}