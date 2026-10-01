// src/lib/lunchGuards.server.js
//
// ด่านตรวจร่วมของทุกหน้าใต้ /lunch/[token] เรียงตามลำดับเดียวกันทุกหน้า:
//   token ไม่รู้จัก -> invalid
//   ถูกยกเลิก/แทนที่ -> replaced
//   ถึง 15:00 แล้ว -> expired (ไม่ว่าสถานะใด)
//   สั่งไปแล้ว -> ให้ sub-route เด้งกลับหน้าแรก
//   เลยเส้นตายแต่ยังไม่ถึง 15:00 -> short (สั่งแบบย่อ at_shop เท่านั้น)
import { getLunchSession } from "@/lib/lunchOrders.server";
import { lunchNow } from "@/lib/lunchClock.server";

export const LUNCH_GATE = {
  INVALID: "invalid",
  REPLACED: "replaced",
  EXPIRED: "expired",
  PLACED: "placed",
  SHORT: "short",
  OK: "ok",
};

// C1: หน้าหมดเวลามี 2 แบบ
//   forfeited : ยังไม่ได้สั่งเลยจนถึง 15:00 = คูปองถูกตัดสิทธิ์
//   ended     : สั่งไปแล้ว (ordered / at_shop) แต่หมดเวลาใช้งานของวันนั้น
export const EXPIRED_KIND = {
  FORFEITED: "forfeited",
  ENDED: "ended",
};

export function expiredKindOf(session) {
  return session?.status === "forfeited" ? EXPIRED_KIND.FORFEITED : EXPIRED_KIND.ENDED;
}

export async function loadLunchGate(token) {
  const session = await getLunchSession(token, lunchNow());

  if (!session) return { gate: LUNCH_GATE.INVALID, session: null };
  if (session.gone) return { gate: LUNCH_GATE.REPLACED, session: null };

  if (session.window?.phase === "expired") {
    return {
      gate: LUNCH_GATE.EXPIRED,
      session,
      expiredKind: expiredKindOf(session),
    };
  }

  const placed = session.status === "ordered" || session.status === "at_shop";
  if (placed) return { gate: LUNCH_GATE.PLACED, session };

  // เลยเส้นตายแล้วแต่ยังไม่ถึง 15:00 และยังไม่ได้สั่ง -> สั่งแบบย่อ
  if (session.window?.phase === "short") {
    return { gate: LUNCH_GATE.SHORT, session };
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
