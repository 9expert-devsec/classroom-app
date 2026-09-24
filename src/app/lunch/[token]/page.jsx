// src/app/lunch/[token]/page.jsx
//
// หน้า 1: กรอกชื่อเล่น + เลือกร้าน
// ถ้าสั่งไปแล้ว หน้านี้จะแสดงสรุปออเดอร์ (ของเดิมจาก P3b) — P3f จะเปลี่ยนเป็น
// หน้าขอบคุณ/สแกนซ้ำ
import dbConnect from "@/lib/mongoose";
import {
  loadLunchGate,
  LUNCH_GATE,
  deadlineLabel,
  thaiDateLabel,
} from "@/lib/lunchGuards.server";

import { Shell, NoticeScreen } from "./_components/Shell";
import ChooseRestaurantClient from "./ChooseRestaurantClient";
import PlacedOrderView from "./_components/PlacedOrderView";

export const dynamic = "force-dynamic";

export function InvalidScreen() {
  return (
    <NoticeScreen
      icon="✕"
      tone="red"
      title="QR ไม่ถูกต้อง"
      body="กรุณาตรวจสอบ QR อีกครั้ง หรือติดต่อเจ้าหน้าที่"
    />
  );
}

export default async function LunchPage({ params }) {
  await dbConnect();

  const token = String(params?.token || "");
  const { gate, session } = await loadLunchGate(token);

  if (gate === LUNCH_GATE.INVALID) return <InvalidScreen />;

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
    const label = deadlineLabel(session.window?.deadlineAt);
    return (
      <NoticeScreen
        icon="🕚"
        tone="red"
        title={`ปิดรับออเดอร์แล้ว (${label} น.)`}
        body="หากยังต้องการสั่งอาหาร กรุณาติดต่อเจ้าหน้าที่ที่ Counter"
      />
    );
  }

  // สั่งไปแล้ว -> สรุปออเดอร์
  if (gate === LUNCH_GATE.PLACED) {
    return (
      <Shell>
        <PlacedOrderView session={session} />
      </Shell>
    );
  }

  const headerLine = [
    `คุณ${session.learner?.fullName || "-"}`,
    session.class?.name || "",
    session.class?.room ? `ห้อง ${session.class.room}` : "",
    thaiDateLabel(session.class?.dayYMD),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Shell>
      <ChooseRestaurantClient
        token={token}
        session={session}
        headerLine={headerLine}
        deadlineLabel={deadlineLabel(session.window?.deadlineAt)}
      />
    </Shell>
  );
}
