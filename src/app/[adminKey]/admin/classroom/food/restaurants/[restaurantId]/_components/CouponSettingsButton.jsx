"use client";

// ปุ่ม "ตั้งค่าคูปอง" บนหัวหน้าร้าน + drawer ด้านขวาที่มี CouponSettingsCard เดิมทั้งก้อน
// drawer ใช้ @radix-ui/react-dialog แบบเดียวกับ ImportDrawer ของหน้าคลังคูปอง Stock
// (Esc / คลิกพื้นหลัง / ปุ่ม X ปิดได้ · focus เข้า drawer ตอนเปิดและกลับมาที่ปุ่มตอนปิด)
import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Ticket, X } from "lucide-react";
import CouponSettingsCard, { useStockSummary } from "./CouponSettingsCard";

const PILL_TONES = {
  grey: "bg-slate-100 text-slate-600",
  brand: "bg-brand-primary/20 text-brand-primaryDark",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
};

/** { text, tone } ของป้ายสถานะคูปองบนปุ่ม — ใช้ข้อมูลชุดเดียวกับการ์ด */
function couponPill(restaurant, summary) {
  if (!restaurant?.couponEnabled) return { text: "ปิด", tone: "grey" };
  if (!restaurant?.usesCouponStock) return { text: "e-coupon", tone: "brand" };

  const n = summary?.availableNotExpired;
  if (n === undefined || n === null) return { text: "stock …", tone: "grey" };
  if (n === 0) {
    return restaurant?.stockFallbackToECoupon
      ? { text: "e-coupon แทน", tone: "amber" }
      : { text: "stock 0 ใบ", tone: "red" };
  }
  const threshold = summary?.restaurant?.couponStockLowThreshold ?? restaurant?.couponStockLowThreshold ?? 5;
  return { text: `stock ${n.toLocaleString()} ใบ`, tone: n <= threshold ? "amber" : "grey" };
}

export default function CouponSettingsButton({ restaurant, adminKey, menus, onSaved }) {
  const [open, setOpen] = useState(false);
  const { summary, reload } = useStockSummary(restaurant);
  const pill = couponPill(restaurant, summary);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reload(); // คงเหลือล่าสุดทุกครั้งที่เปิด
      }}
    >
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          disabled={!restaurant}
          aria-label={`ตั้งค่าคูปอง (${pill.text})`}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-admin-border bg-white px-3 text-xs text-admin-text shadow-sm transition hover:bg-admin-surfaceMuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/70 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Ticket className="h-4 w-4" aria-hidden="true" />
          ตั้งค่าคูปอง
          <span
            aria-hidden="true"
            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${PILL_TONES[pill.tone]}`}
          >
            {pill.text}
          </span>
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/40" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-admin-bg shadow-2xl outline-none sm:max-w-[480px]">
          <div className="flex items-start justify-between gap-3 border-b border-admin-border bg-white px-5 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-bold">ตั้งค่าคูปอง</DialogPrimitive.Title>
              <DialogPrimitive.Description className="truncate text-xs text-admin-textMuted">
                {restaurant?.name || ""}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="ปิด"
                className="rounded-full p-1.5 text-admin-textMuted hover:bg-admin-surfaceMuted"
              >
                <X className="h-5 w-5" />
              </button>
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
            <CouponSettingsCard
              restaurant={restaurant}
              adminKey={adminKey}
              menus={menus}
              onSaved={onSaved}
              stockSummary={summary}
              onStockReload={reload}
              stacked
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
