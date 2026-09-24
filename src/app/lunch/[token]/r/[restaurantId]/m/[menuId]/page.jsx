// src/app/lunch/[token]/r/[restaurantId]/m/[menuId]/page.jsx
//
// หน้ารายละเอียดเมนู: ตัวเลือก / หมายเหตุ / จำนวน แล้วเพิ่มลงตะกร้า
import { redirect } from "next/navigation";

import dbConnect from "@/lib/mongoose";
import {
  loadLunchGate,
  LUNCH_GATE,
  deadlineLabel,
} from "@/lib/lunchGuards.server";
import { getDaySet } from "@/lib/couponAvailability.server";
import { loadRestaurantMenu } from "@/lib/lunchMenu.server";

import { Shell } from "../../../../_components/Shell";
import GateNotice, { BackNotice } from "../../../../_components/GateNotice";
import MenuDetailClient from "./MenuDetailClient";

export const dynamic = "force-dynamic";

export default async function MenuDetailPage({ params }) {
  await dbConnect();

  const token = String(params?.token || "");
  const restaurantId = String(params?.restaurantId || "");
  const menuId = String(params?.menuId || "");
  const { gate, session } = await loadLunchGate(token);

  const notice = GateNotice({ gate, session });
  if (notice) return notice;
  if (gate === LUNCH_GATE.PLACED) redirect(`/lunch/${token}`);

  // ร้านไม่อยู่ในรายการ / ปิด / คูปองหมด -> หน้าเมนูของร้านเป็นคนแจ้งเหตุผล
  const restaurant = (session.restaurants || []).find((r) => r.id === restaurantId);
  if (!restaurant || restaurant.state !== "open") {
    redirect(`/lunch/${token}/r/${restaurantId}`);
  }

  const daySet = await getDaySet(session.class?.dayYMD);
  const { menus } = await loadRestaurantMenu({ daySet, restaurantId });
  const menu = menus.find((m) => m.id === menuId);
  const backHref = `/lunch/${token}/r/${restaurantId}`;

  if (!menu) {
    return (
      <BackNotice
        title="ไม่พบเมนูนี้"
        body={`เมนูนี้ไม่มีอยู่ในร้าน ${restaurant.name} แล้ว`}
        href={backHref}
        label="กลับไปหน้าเมนู"
      />
    );
  }
  if (menu.unavailableToday || menu.price === null) {
    return (
      <BackNotice
        title={`${menu.name} หมดวันนี้`}
        body="กรุณาเลือกเมนูอื่น"
        href={backHref}
        label="กลับไปหน้าเมนู"
      />
    );
  }

  return (
    <Shell>
      <MenuDetailClient
        token={token}
        restaurant={restaurant}
        restaurants={session.restaurants || []}
        budget={session.budget}
        windowInfo={session.window}
        deadlineLabel={deadlineLabel(session.window?.deadlineAt)}
        menu={menu}
        menus={menus}
      />
    </Shell>
  );
}
