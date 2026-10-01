// src/app/m/[key]/[restaurantId]/page.jsx
//
// C3d: Merchant — หน้าร้าน: สแกน QR / พิมพ์รหัส -> ดูข้อมูล -> Confirm -> Complete
// key ไม่ตรง หรือร้านไม่อยู่ในกลุ่มที่ Merchant ให้บริการ -> 404
import { notFound } from "next/navigation";

import dbConnect from "@/lib/mongoose";
import { isValidMerchantKey } from "@/lib/merchantKey.server";
import { getMerchantRestaurant } from "@/lib/merchantLunch.server";
import MerchantShopClient from "./MerchantShopClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "E-coupon Merchant | 9Expert",
  robots: { index: false, follow: false },
};

export default async function MerchantShopPage({ params }) {
  const key = String(params?.key || "");
  if (!isValidMerchantKey(key)) notFound();

  await dbConnect();
  const restaurant = await getMerchantRestaurant(params?.restaurantId);
  if (!restaurant) notFound();

  return <MerchantShopClient merchantKey={key} restaurant={restaurant} />;
}
