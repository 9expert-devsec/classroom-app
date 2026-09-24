// src/app/lunch/[token]/r/[restaurantId]/page.jsx
//
// หน้า 2: เมนูของร้านที่เลือก
import Link from "next/link";
import { redirect } from "next/navigation";

import dbConnect from "@/lib/mongoose";
import FoodMenu from "@/models/FoodMenu";
import FoodMenuCategory from "@/models/FoodMenuCategory";

import {
  loadLunchGate,
  LUNCH_GATE,
  deadlineLabel,
} from "@/lib/lunchGuards.server";
import { getDaySet } from "@/lib/couponAvailability.server";

import { Shell, NoticeScreen } from "../../_components/Shell";
import MenuClient from "./MenuClient";

export const dynamic = "force-dynamic";

export default async function RestaurantMenuPage({ params }) {
  await dbConnect();

  const token = String(params?.token || "");
  const restaurantId = String(params?.restaurantId || "");
  const { gate, session } = await loadLunchGate(token);

  if (gate === LUNCH_GATE.INVALID) {
    return (
      <NoticeScreen
        icon="✕"
        tone="red"
        title="QR ไม่ถูกต้อง"
        body="กรุณาตรวจสอบ QR อีกครั้ง หรือติดต่อเจ้าหน้าที่"
      />
    );
  }
  if (gate === LUNCH_GATE.REPLACED) {
    return (
      <NoticeScreen
        icon="⟳"
        tone="amber"
        title="QR นี้ถูกแทนที่แล้ว"
        body="กรุณาติดต่อเจ้าหน้าที่"
      />
    );
  }
  if (gate === LUNCH_GATE.CLOSED) {
    return (
      <NoticeScreen
        icon="🕚"
        tone="red"
        title={`ปิดรับออเดอร์แล้ว (${deadlineLabel(session.window?.deadlineAt)} น.)`}
        body="หากยังต้องการสั่งอาหาร กรุณาติดต่อเจ้าหน้าที่ที่ Counter"
      />
    );
  }
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
  const entry = (daySet?.entries || []).find(
    (e) => String(e.restaurant) === restaurantId,
  );
  const soldOut = new Set((entry?.soldOutMenuIds || []).map((x) => String(x)));

  const [categories, menus] = await Promise.all([
    FoodMenuCategory.find({ restaurant: restaurantId, isActive: { $ne: false } })
      .sort({ sortOrder: 1, createdAt: 1 })
      .select("name")
      .lean(),
    FoodMenu.find({ restaurant: restaurantId, isActive: { $ne: false } })
      .sort({ sortOrder: 1, name: 1 })
      .select("name imageUrl price description categoryIds optionGroups")
      .lean(),
  ]);

  const menuDTO = menus.map((m) => ({
    id: String(m._id),
    name: m.name || "",
    image: m.imageUrl || "",
    price: m.price ?? null,
    description: m.description || "",
    categoryIds: (m.categoryIds || []).map((x) => String(x)),
    unavailableToday: soldOut.has(String(m._id)),
    optionGroups: (m.optionGroups || []).map((g) => ({
      id: String(g._id),
      name: g.name || "",
      required: !!g.required,
      selectType: g.selectType === "multi" ? "multi" : "single",
      choices: (g.choices || [])
        .filter((c) => c?.isActive !== false)
        .map((c) => ({
          id: String(c._id),
          name: c.name || "",
          priceDelta: c.priceDelta || 0,
        })),
    })),
  }));

  return (
    <Shell>
      <MenuClient
        token={token}
        restaurant={restaurant}
        others={(session.restaurants || []).filter((r) => r.id !== restaurantId)}
        budget={session.budget}
        windowInfo={session.window}
        deadlineLabel={deadlineLabel(session.window?.deadlineAt)}
        categories={categories.map((c) => ({ id: String(c._id), name: c.name }))}
        menus={menuDTO}
      />
    </Shell>
  );
}
