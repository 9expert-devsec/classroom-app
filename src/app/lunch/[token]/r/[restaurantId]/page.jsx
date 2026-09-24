// src/app/lunch/[token]/r/[restaurantId]/page.jsx
//
// หน้า 2: เมนูของร้านที่เลือก
import Link from "next/link";
import { redirect } from "next/navigation";

import dbConnect from "@/lib/mongoose";

import {
  loadLunchGate,
  LUNCH_GATE,
  deadlineLabel,
} from "@/lib/lunchGuards.server";
import { getDaySet } from "@/lib/couponAvailability.server";
import { loadRestaurantMenu } from "@/lib/lunchMenu.server";

import { Shell, NoticeScreen } from "../../_components/Shell";
import GateNotice from "../../_components/GateNotice";
import MenuClient from "./MenuClient";

export const dynamic = "force-dynamic";

export default async function RestaurantMenuPage({ params }) {
  await dbConnect();

  const token = String(params?.token || "");
  const restaurantId = String(params?.restaurantId || "");
  const { gate, session } = await loadLunchGate(token);

  const notice = GateNotice({ gate, session });
  if (notice) return notice;
  // สั่งไปแล้ว -> กลับหน้าแรก
  if (gate === LUNCH_GATE.PLACED) redirect(`/lunch/${token}`);

  const restaurant = (session.restaurants || []).find((r) => r.id === restaurantId);

  // ไม่อยู่ในรายการของวันนี้เลย = ถือว่า QR/ลิงก์ผิด
  if (!restaurant) {
    return (
      <NoticeScreen
        icon="✕"
        tone="red"
        title="QR ไม่ถูกต้อง"
        body="ไม่พบร้านนี้ในรายการของวันนี้"
      />
    );
  }

  // อยู่ในรายการแต่ปิด/คูปองหมด -> บอกเหตุผลแล้วให้กลับไปเลือกใหม่
  if (restaurant.state !== "open") {
    return (
      <Shell>
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200/60 text-3xl">
            🚫
          </div>
          <h1 className="text-[19px] font-bold text-[#0d1b2a]">
            {restaurant.state === "closed"
              ? `ร้าน ${restaurant.name} ปิดวันนี้`
              : `คูปองของร้าน ${restaurant.name} หมดแล้ว`}
          </h1>
          <Link
            href={`/lunch/${token}`}
            className="h-11 rounded-xl bg-[#2486ff] px-6 text-[15px] font-semibold leading-[44px] text-white shadow-sm"
          >
            เลือกร้านอื่น
          </Link>
        </div>
      </Shell>
    );
  }

  // ---- เมนูของร้านนี้สำหรับวันนั้น ----
  const daySet = await getDaySet(session.class?.dayYMD);
  const { categories, menus } = await loadRestaurantMenu({ daySet, restaurantId });

  return (
    <Shell>
      <MenuClient
        token={token}
        restaurant={restaurant}
        others={(session.restaurants || []).filter((r) => r.id !== restaurantId)}
        budget={session.budget}
        windowInfo={session.window}
        deadlineLabel={deadlineLabel(session.window?.deadlineAt)}
        categories={categories}
        menus={menus}
      />
    </Shell>
  );
}
