// src/app/m/redeem/page.jsx
import RedeemClient from "./RedeemClient";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  return <RedeemClient searchParams={searchParams || {}} />;
}
