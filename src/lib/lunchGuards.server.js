// src/lib/lunchGuards.server.js
//
// ด่านตรวจร่วมของทุกหน้าใต้ /lunch/[token] เรียงตามลำดับเดียวกันทุกหน้า:
//   token ไม่รู้จัก -> invalid
//   ถูกยกเลิก/แทนที่ -> replaced
//   ปิดรับแล้ว และยังไม่ได้สั่ง -> closed
//   สั่งไปแล้ว -> ให้ sub-route เด้งกลับหน้าแรก
import { getLunchSession } from "@/lib/lunchOrders.server";

export const LUNCH_GATE = {
  INVALID: "invalid",
  REPLACED: "replaced",
  CLOSED: "closed",
  PLACED: "placed",
  OK: "ok",
};

export async function loadLunchGate(token) {
  const session = await getLunchSession(token, new Date());

  if (!session) return { gate: LUNCH_GATE.INVALID, session: null };
  if (session.gone) return { gate: LUNCH_GATE.REPLACED, session: null };

  const placed = session.status === "ordered" || session.status === "at_shop";
  if (placed) return { gate: LUNCH_GATE.PLACED, session };

  // ปิดรับแล้วและยังไม่ได้สั่ง (pending / unassigned)
  if (session.window?.phase === "closed") {
    return { gate: LUNCH_GATE.CLOSED, session };
  }

  return { gate: LUNCH_GATE.OK, session };
}

/** "11:15" ของเส้นตายจริง เวลาไทย — ไม่ฮาร์ดโค้ด */
export function deadlineLabel(deadlineAt) {
  if (!deadlineAt) return "";
  return new Date(deadlineAt).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

/** 24 ก.ย. 2569 */
export function thaiDateLabel(dayYMD) {
  if (!dayYMD) return "";
  const d = new Date(`${dayYMD}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return dayYMD;
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}
