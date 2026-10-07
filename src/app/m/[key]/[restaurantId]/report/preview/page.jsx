// src/app/m/[key]/[restaurantId]/report/preview/page.jsx
//
// C4: Merchant — รูปสรุปการใช้คูปอง (PNG) ของช่วงที่เลือก พร้อมปุ่มบันทึกรูป
// key ไม่ตรง หรือร้านไม่อยู่ในกลุ่มที่ Merchant ให้บริการ -> 404
import { notFound } from "next/navigation";

import dbConnect from "@/lib/mongoose";
import { isValidMerchantKey } from "@/lib/merchantKey.server";
import { getMerchantRestaurant } from "@/lib/merchantLunch.server";
import PreviewClient from "./PreviewClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Summary image | E-coupon Merchant",
  robots: { index: false, follow: false },
};

export default async function MerchantReportPreviewPage({ params }) {
  const key = String(params?.key || "");
  if (!isValidMerchantKey(key)) notFound();

  await dbConnect();
  const restaurant = await getMerchantRestaurant(params?.restaurantId);
  if (!restaurant) notFound();

  return <PreviewClient merchantKey={key} restaurant={restaurant} />;
}
