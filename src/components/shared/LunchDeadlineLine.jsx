// บรรทัดเส้นตายใต้ QR สั่งอาหาร — ตัวเดียวของแท็บเล็ต Step 3 และหน้า "แสดง QR สั่งอาหาร"
//   ยังเปิดอยู่   -> "สั่งได้ถึง HH:MM น." จากเส้นตายจริงของใบนั้น (เปิดพิเศษ/ออกใหม่ไม่ใช่ 11:15)
//   เลยเวลาแล้ว  -> โน้ตสีเหลืองให้ไปที่ Counter (QR ยังแสดงอยู่ เพราะใช้ดูรหัสคูปองได้)
//   สั่งแล้ว       -> ไม่ต้องบอกเส้นตาย
// ไม่ยืดเวลาให้เองเด็ดขาด — ทำได้เฉพาะ admin/Counter เปิดพิเศษ
import { AlertTriangle } from "lucide-react";

export const LUNCH_LATE_NOTE =
  "เลยเวลาสั่งแล้ว กรุณาแจ้งเจ้าหน้าที่ที่ Counter เพื่อเปิดเวลาพิเศษ";

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

export default function LunchDeadlineLine({ deadlineAt, phase, status }) {
  if (status === "ordered" || status === "at_shop" || status === "cancelled") return null;

  if (phase === "closed" || status === "unassigned") {
    return (
      <p
        data-testid="late-note"
        className="mx-auto mt-3 flex max-w-md items-start gap-2 rounded-2xl bg-amber-100 px-4 py-3 text-left text-amber-800 sm:text-lg lg:text-sm"
      >
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        {LUNCH_LATE_NOTE}
      </p>
    );
  }

  const hm = hmBkk(deadlineAt);
  if (!hm) return null;
  return (
    <p data-testid="deadline-line" className="mt-1 text-front-textMuted sm:text-lg lg:text-base">
      สั่งได้ถึง {hm} น.
    </p>
  );
}
