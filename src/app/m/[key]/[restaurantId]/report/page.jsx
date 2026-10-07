// src/app/m/[key]/[restaurantId]/report/page.jsx
//
// C4: Merchant — สรุปการใช้คูปองของร้านนี้ (Today / This week / This month)
// key ไม่ตรง หรือร้านไม่อยู่ในกลุ่มที่ Merchant ให้บริการ -> 404
import { notFound } from "next/navigation";

import dbConnect from "@/lib/mongoose";
import { isValidMerchantKey } from "@/lib/merchantKey.server";
import { getMerchantRestaurant } from "@/lib/merchantLunch.server";
import ReportClient from "./ReportClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Usage summary | E-coupon Merchant",
  robots: { index: false, follow: false },
};

export default async function MerchantReportPage({ params }) {
  const key = String(params?.key || "");
  if (!isValidMerchantKey(key)) notFound();

  await dbConnect();
  const restaurant = await getMerchantRestaurant(params?.restaurantId);
  if (!restaurant) notFound();

  return <ReportClient merchantKey={key} restaurant={restaurant} />;
}
