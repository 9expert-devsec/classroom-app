// บรรทัดเส้นตายใต้ QR สั่งอาหาร — ตัวเดียวของแท็บเล็ต Step 3 และหน้า "แสดง QR สั่งอาหาร"
//   ยังเปิดอยู่        -> "สั่งได้ถึง HH:MM น." จากเส้นตายจริงของใบนั้น (ออก QR ใหม่ไม่ใช่ 11:15)
//   เลยเส้นตาย (short) -> โน้ตสีเหลือง: ยังสั่งแบบย่อได้ถึง 15:00 (QR ยังใช้ได้)
//   ถึง 15:00 (expired) -> ยังไม่สั่ง = คูปองหมดอายุ / สั่งแล้ว = หมดเวลาการใช้งาน
//   สั่งแล้วก่อน 15:00   -> ไม่ต้องบอกเส้นตาย
// ไม่ยืดเวลาให้เองเด็ดขาด — ทำได้เฉพาะ Counter ยกเลิก + ออก QR ใหม่ ให้คนที่สั่งแล้ว
import { AlertTriangle } from "lucide-react";
import { lunchTimes } from "@/lib/lunchConfig";

// C3a: เวลาปิดมาจาก server (finalHM ที่ API ส่งมาจาก lunchTimes) — ไม่มีก็ใช้ค่าปกติ
export function lunchShortNote(finalHM) {
  return `เลยเวลาสั่งแบบเลือกเมนูแล้ว · ยังสแกนเพื่อรับคูปองแล้วไปสั่งที่ร้านได้ถึง ${finalHM || lunchTimes().final} น.`;
}
export const LUNCH_FORFEITED_NOTE = "คูปองหมดอายุ ไม่สามารถใช้งานได้";
export const LUNCH_ENDED_NOTE = "หมดเวลาการใช้งานตามเงื่อนไขของระบบ";

function Note({ testId, children }) {
  return (
    <p
      data-testid={testId}
      className="mx-auto mt-3 flex max-w-md items-start gap-2 rounded-2xl bg-amber-100 px-4 py-3 text-left text-amber-800 sm:text-lg lg:text-sm"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      {children}
    </p>
  );
}

function hmBkk(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

export default function LunchDeadlineLine({ deadlineAt, phase, status, finalHM }) {
  if (status === "cancelled") return null;
  const placed = status === "ordered" || status === "at_shop";

  if (phase === "expired" || status === "forfeited") {
    return (
      <Note testId="expired-note">{placed ? LUNCH_ENDED_NOTE : LUNCH_FORFEITED_NOTE}</Note>
    );
  }

  if (placed) return null;

  if (phase === "short") {
    return <Note testId="late-note">{lunchShortNote(finalHM)}</Note>;
  }

  const hm = hmBkk(deadlineAt);
  if (!hm) return null;
  return (
    <p data-testid="deadline-line" className="mt-1 text-front-textMuted sm:text-lg lg:text-base">
      สั่งได้ถึง {hm} น.
    </p>
  );
}
