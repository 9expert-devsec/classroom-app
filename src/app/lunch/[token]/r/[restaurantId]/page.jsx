// src/app/lunch/[token]/r/[restaurantId]/page.jsx
//
// หน้า 2: เมนูของร้านที่เลือก
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { X, Ban } from "lucide-react";

import dbConnect from "@/lib/mongoose";

import {
  loadLunchGate,
  LUNCH_GATE,
  deadlineLabel,
} from "@/lib/lunchGuards.server";
import { getDaySet } from "@/lib/couponAvailability.server";
import { loadRestaurantMenu } from "@/lib/lunchMenu.server";

import { Shell, NoticeScreen } from "../../_components/Shell";
import ShellScroll from "../../_components/ShellScroll";
import GateNotice from "../../_components/GateNotice";
import FlowGuard from "../../_components/FlowGuard";
import MenuClient from "./MenuClient";

export const dynamic = "force-dynamic";

// ?sheet=<menuId> — กลับจากหน้าแก้ไขบรรทัด แล้วเปิดชีตของเมนูนั้นต่อ
export default async function RestaurantMenuPage({ params, searchParams }) {
  await dbConnect();

  const token = String(params?.token || "");
  const restaurantId = String(params?.restaurantId || "");
  const { gate, session } = await loadLunchGate(token);

  const notice = GateNotice({ gate, session });
  if (notice) return notice;
  // สั่งไปแล้ว -> กลับหน้าแรก
  if (gate === LUNCH_GATE.PLACED) redirect(`/lunch/${token}`);
  // C1: เลยเส้นตายแล้ว -> สั่งแบบย่อของร้านนี้ (ไม่มีเมนู)
  if (gate === LUNCH_GATE.SHORT) redirect(`/lunch/${token}/short/${restaurantId}`);

  const restaurant = (session.restaurants || []).find((r) => r.id === restaurantId);

  // ไม่อยู่ในรายการของวันนี้เลย = ถือว่า QR/ลิงก์ผิด
  if (!restaurant) {
    return (
      <NoticeScreen
        icon={X}
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
        <ShellScroll>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200/60 text-slate-500">
              <Ban aria-hidden="true" className="h-8 w-8" />
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
        </ShellScroll>
      </Shell>
    );
  }

  // ---- เมนูของร้านนี้สำหรับวันนั้น ----
  const daySet = await getDaySet(session.class?.dayYMD);
  const { categories, menus } = await loadRestaurantMenu({ daySet, restaurantId });

  return (
    <Shell>
      <FlowGuard token={token} renderId={randomUUID()}>
        <MenuClient
          token={token}
          restaurant={restaurant}
          others={(session.restaurants || []).filter((r) => r.id !== restaurantId)}
          shops={session.restaurants || []}
          budget={session.budget}
          windowInfo={session.window}
          deadlineLabel={deadlineLabel(session.window?.deadlineAt)}
          categories={categories}
          openSheetMenuId={String(searchParams?.sheet || "")}
          menus={menus}
        />
      </FlowGuard>
    </Shell>
  );
}
