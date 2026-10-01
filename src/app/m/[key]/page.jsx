// src/app/m/[key]/page.jsx
//
// C3d: Merchant — shop picker (ร้านที่เปิดคูปองและไม่ใช้คูปอง stock เท่านั้น)
// key ใน path ต้องตรง MERCHANT_PATH_KEY (timing-safe) ไม่งั้น 404
import { notFound } from "next/navigation";

import dbConnect from "@/lib/mongoose";
import { isValidMerchantKey } from "@/lib/merchantKey.server";
import { listMerchantRestaurants } from "@/lib/merchantLunch.server";
import ShopPickerClient from "./ShopPickerClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "E-coupon Merchant | 9Expert",
  robots: { index: false, follow: false },
};

export default async function MerchantHomePage({ params }) {
  const key = String(params?.key || "");
  if (!isValidMerchantKey(key)) notFound();

  await dbConnect();
  const restaurants = await listMerchantRestaurants();

  return <ShopPickerClient merchantKey={key} restaurants={restaurants} />;
}
