// src/app/lunch/[token]/summary/page.jsx
//
// หน้าสรุปรายการ + ยืนยันการสั่งอาหาร
// ร้านของตะกร้าอยู่ใน localStorage ฝั่ง client เมนู DTO จึงโหลดจาก
// /api/lunch/[token]/menu ฝั่ง client
import { redirect } from "next/navigation";

import dbConnect from "@/lib/mongoose";
import {
  loadLunchGate,
  LUNCH_GATE,
  deadlineLabel,
} from "@/lib/lunchGuards.server";

import { Shell } from "../_components/Shell";
import GateNotice from "../_components/GateNotice";
import SummaryClient from "./SummaryClient";

export const dynamic = "force-dynamic";

export default async function SummaryPage({ params }) {
  await dbConnect();

  const token = String(params?.token || "");
  const { gate, session } = await loadLunchGate(token);

  const notice = GateNotice({ gate, session });
  if (notice) return notice;
  if (gate === LUNCH_GATE.PLACED) redirect(`/lunch/${token}`);

  return (
    <Shell>
      <SummaryClient
        token={token}
        restaurants={session.restaurants || []}
        sessionNickname={session.learner?.nickname || ""}
        budget={session.budget}
        windowInfo={session.window}
        deadlineLabel={deadlineLabel(session.window?.deadlineAt)}
      />
    </Shell>
  );
}
