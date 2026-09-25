// ป้ายสถานะออเดอร์อาหารกลางวัน — ใช้ทั้งหน้าแอดมินและแท็บเล็ต
// unassigned = pending ที่เลยเวลาแล้ว (คำนวณ ไม่ได้เก็บใน DB)

export const LUNCH_STATUS_LABELS = {
  pending: "รอสั่ง",
  unassigned: "เลยเวลา",
  ordered: "สั่งแล้ว",
  at_shop: "ไปสั่งที่ร้าน",
  cancelled: "ยกเลิก",
};

const STYLES = {
  pending: "bg-blue-100 text-blue-700",
  unassigned: "bg-amber-100 text-amber-700",
  ordered: "bg-green-100 text-green-700",
  at_shop: "bg-teal-100 text-teal-700",
  cancelled: "bg-slate-200 text-slate-500",
};

export default function LunchStatusBadge({ status, size = "sm" }) {
  const cls = STYLES[status] || "bg-slate-100 text-slate-600";
  const text = size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[11px]";
  return (
    <span
      data-testid="lunch-status"
      data-status={status}
      className={`inline-flex items-center whitespace-nowrap rounded-full font-medium ${text} ${cls}`}
    >
      {LUNCH_STATUS_LABELS[status] || status}
    </span>
  );
}
