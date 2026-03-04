// src/app/m/login/page.jsx
import MerchantLoginClient from "./MerchantLoginClient";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  return <MerchantLoginClient searchParams={searchParams || {}} />;
}
