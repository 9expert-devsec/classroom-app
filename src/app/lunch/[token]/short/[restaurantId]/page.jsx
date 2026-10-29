// src/app/lunch/[token]/short/[restaurantId]/page.jsx
//
// หน้าสรุป "สั่งที่ร้านเอง" (at_shop) — หน้าเดียวของทั้ง 2 ทาง:
//   ก่อนเส้นตาย: การ์ด "สั่งที่ร้านเอง" ในหน้าเมนู (?from=menu)
//   หลังเส้นตาย (C1 แบบย่อ ถึง 15:00): ชื่อเล่น -> เลือกร้าน -> หน้านี้
// ไม่มีเมนู: ชื่อเล่น + ร้าน + คูปอง -> ยืนยัน -> at_shop (API รับ at_shop ได้ถึงเวลาปิดจริง)
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import dbConnect from "@/lib/mongoose";
import { loadLunchGate, LUNCH_GATE, deadlineLabel } from "@/lib/lunchGuards.server";

import { Shell } from "../../_components/Shell";
import GateNotice from "../../_components/GateNotice";
import FlowGuard from "../../_components/FlowGuard";
import ShortSummaryClient from "./ShortSummaryClient";

export const dynamic = "force-dynamic";

export default async function ShortSummaryPage({ params, searchParams }) {
  await dbConnect();

  const token = String(params?.token || "");
  const restaurantId = String(params?.restaurantId || "");
  const { gate, session } = await loadLunchGate(token);

  const notice = GateNotice({ gate, session });
  if (notice) return notice;
  if (gate === LUNCH_GATE.PLACED) redirect(`/lunch/${token}`);
  // เปิดได้ทั้ง OK (ก่อนเส้นตาย) และ SHORT (หลังเส้นตาย) — ด่านอื่นถูกตัดไปแล้วข้างบน

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
      <FlowGuard token={token} renderId={randomUUID()}>
        <ShortSummaryClient
          token={token}
          restaurant={restaurant}
          restaurants={session.restaurants || []}
          sessionNickname={session.learner?.nickname || ""}
          budget={session.budget}
          windowInfo={session.window}
          deadlineLabel={deadlineLabel(session.window?.deadlineAt)}
          from={String(searchParams?.from || "")}
          confirmed={String(searchParams?.confirmed || "")}
        />
      </FlowGuard>
    </Shell>
  );
}
