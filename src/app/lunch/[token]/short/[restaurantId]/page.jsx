// src/app/lunch/[token]/short/[restaurantId]/page.jsx
//
// C1: หน้าสรุปแบบย่อ — เลยเส้นตายแล้วแต่ยังไม่ถึง 15:00
// ไม่มีเมนู: ชื่อเล่น + ร้าน + งบ -> ยืนยัน -> at_shop (รับคูปองแล้วไปสั่งที่ร้าน)
import { redirect } from "next/navigation";

import dbConnect from "@/lib/mongoose";
import { loadLunchGate, LUNCH_GATE } from "@/lib/lunchGuards.server";

import { Shell } from "../../_components/Shell";
import GateNotice from "../../_components/GateNotice";
import ShortSummaryClient from "./ShortSummaryClient";

export const dynamic = "force-dynamic";

export default async function ShortSummaryPage({ params }) {
  await dbConnect();

  const token = String(params?.token || "");
  const restaurantId = String(params?.restaurantId || "");
  const { gate, session } = await loadLunchGate(token);

  const notice = GateNotice({ gate, session });
  if (notice) return notice;
  if (gate === LUNCH_GATE.PLACED) redirect(`/lunch/${token}`);
  // ยังไม่เลยเส้นตาย -> สั่งแบบเต็ม (มีเมนู) ตามปกติ
  if (gate === LUNCH_GATE.OK) redirect(`/lunch/${token}/r/${restaurantId}`);

  const restaurant = (session.restaurants || []).find((r) => r.id === restaurantId);
  if (!restaurant) {
    redirect(`/lunch/${token}?notice=restaurant_unavailable`);
  }
  if (restaurant.state !== "open") {
    redirect(
      `/lunch/${token}?notice=${restaurant.state === "sold_out" ? "sold_out" : "restaurant_unavailable"}`,
    );
  }

  return (
    <Shell>
      <ShortSummaryClient
        token={token}
        restaurant={restaurant}
        sessionNickname={session.learner?.nickname || ""}
        budget={session.budget}
      />
    </Shell>
  );
}
