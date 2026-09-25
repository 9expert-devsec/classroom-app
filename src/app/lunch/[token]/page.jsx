// src/app/lunch/[token]/page.jsx
//
// หน้า 1: กรอกชื่อเล่น + เลือกร้าน
// ถ้าสั่งไปแล้ว: ?done=1 (เพิ่ง submit) = หน้าขอบคุณ, ไม่มี = หน้าสแกนซ้ำแบบดูอย่างเดียว
import { X, RefreshCw, Clock } from "lucide-react";

import dbConnect from "@/lib/mongoose";
import {
  loadLunchGate,
  LUNCH_GATE,
  deadlineLabel,
  thaiDateLabel,
} from "@/lib/lunchGuards.server";

import { Shell, NoticeScreen } from "./_components/Shell";
import ChooseRestaurantClient from "./ChooseRestaurantClient";
import { ThankYouView, RescanView } from "./_components/PlacedViews";

export const dynamic = "force-dynamic";

export function InvalidScreen() {
  return (
    <NoticeScreen
      icon={X}
      tone="red"
      title="QR ไม่ถูกต้อง"
      body="กรุณาตรวจสอบ QR อีกครั้ง หรือติดต่อเจ้าหน้าที่"
    />
  );
}

// ข้อความที่หน้าอื่นส่งกลับมาทาง ?notice= (เช่น submit แล้วคูปองหมด)
const NOTICES = {
  sold_out: "คูปองร้านนี้หมดแล้ว กรุณาเลือกร้านอื่น",
  restaurant_unavailable: "ร้านนี้ไม่เปิดรับคูปองในวันนี้ กรุณาเลือกร้านอื่น",
};

export default async function LunchPage({ params, searchParams }) {
  await dbConnect();

  const token = String(params?.token || "");
  const { gate, session } = await loadLunchGate(token);

  if (gate === LUNCH_GATE.INVALID) return <InvalidScreen />;

  if (gate === LUNCH_GATE.REPLACED) {
    return (
      <NoticeScreen
        icon={RefreshCw}
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
        icon={Clock}
        tone="red"
        title={`ปิดรับออเดอร์แล้ว (${label} น.)`}
        body="หากยังต้องการสั่งอาหาร กรุณาติดต่อเจ้าหน้าที่ที่ Counter"
      />
    );
  }

  // สั่งไปแล้ว -> มาจากการ submit (?done=1) = หน้าขอบคุณ, สแกนซ้ำ = ดูอย่างเดียว
  if (gate === LUNCH_GATE.PLACED) {
    const dateLabel = thaiDateLabel(session.order?.dayYMD);
    return (
      <Shell>
        {String(searchParams?.done || "") === "1" ? (
          <ThankYouView order={session.order} dateLabel={dateLabel} />
        ) : (
          <RescanView order={session.order} dateLabel={dateLabel} />
        )}
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
        notice={NOTICES[String(searchParams?.notice || "")] || ""}
      />
    </Shell>
  );
}
