"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import Toggle from "./Toggle";
import { hasPrice } from "./menuUi";

async function safeJson(res) {
  const t = await res.text().catch(() => "");
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
}

function SettingRow({ title, description, checked, disabled, dimmed, label, onChange, children }) {
  return (
    <div
      className={`rounded-2xl border border-admin-border bg-white p-3 ${dimmed ? "bg-slate-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`min-w-0 ${dimmed ? "opacity-60" : ""}`}>
          <div className="text-sm font-semibold text-admin-text">{title}</div>
          <p className="mt-0.5 text-[11px] text-admin-textMuted">{description}</p>
        </div>
        <Toggle checked={checked} disabled={disabled} label={label} onChange={onChange} />
      </div>
      {children}
    </div>
  );
}

function ConfirmOff({ confirm, onCancel, onConfirm }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm rounded-2xl bg-white">
        <DialogTitle className="text-base">{confirm.title}</DialogTitle>
        <DialogDescription className="text-sm text-admin-textMuted">
          {confirm.body}
        </DialogDescription>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-admin-border bg-white py-2 text-sm font-medium hover:bg-admin-surfaceMuted"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            ยืนยัน
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Code 128 barcode on the learner ticket — only shops that issue e-coupons (non-stock, or stock with fallback on).
 * Ineligible (stock, fallback off): faded + hint; the switch stays usable only to turn an existing ON off.
 */
function BarcodeToggle({ checked, disabled, eligible = true, onChange }) {
  const label = "แสดงบาร์โค้ดบน e-coupon (สำหรับเครื่องสแกน POS แบบ 1 มิติ)";
  // the server rejects true for ineligible shops; false is always allowed
  const locked = !eligible && !checked;
  return (
    <div className="mt-3 flex items-start justify-between gap-4 border-t border-admin-border pt-3">
      <div className={`min-w-0 ${eligible ? "" : "opacity-50"}`}>
        <div className="text-xs font-semibold text-admin-text">{label}</div>
        <p className="mt-0.5 text-[11px] text-admin-textMuted">
          {eligible
            ? "บาร์โค้ด Code 128 ของรหัส 9XP-XXXX แสดงใต้ QR บนหน้าคูปองของผู้เรียน"
            : "เปิด 'เมื่อคูปองกระดาษหมด ให้ออก e-coupon จากระบบแทน' ก่อน จึงจะตั้งค่านี้ได้"}
        </p>
      </div>
      <Toggle
        checked={checked}
        disabled={disabled || locked}
        label={label}
        onChange={(v) => (eligible || !v) && onChange(v)}
      />
    </div>
  );
}

/** Stock summary (both flags on): available count + threshold + link */
function StockSummary({ restaurant, adminKey, onSaved }) {
  const restaurantId = String(restaurant?._id || "");
  const savedThreshold = restaurant?.couponStockLowThreshold ?? 5;

  const [summary, setSummary] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [threshold, setThreshold] = useState(String(savedThreshold));
  const [savingThreshold, setSavingThreshold] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/food/coupon-stock/summary?restaurantId=${encodeURIComponent(restaurantId)}`,
          { cache: "no-store" },
        );
        const data = await safeJson(res);
        if (!ignore && res.ok) setSummary(data);
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [restaurantId, savedThreshold, reloadKey]);

  async function saveThreshold() {
    const n = Number(threshold);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("เกณฑ์เตือนต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
      return;
    }
    setSavingThreshold(true);
    try {
      const res = await fetch(`/api/admin/food/restaurants/${restaurantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponStockLowThreshold: Math.floor(n) }),
      });
      const out = await safeJson(res);
      if (!res.ok) {
        toast.error(out.error || "บันทึกเกณฑ์เตือนไม่สำเร็จ");
        return;
      }
      onSaved?.(out.item);
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      toast.error("บันทึกเกณฑ์เตือนไม่สำเร็จ");
    } finally {
      setSavingThreshold(false);
    }
  }

  const available = summary?.availableNotExpired;
  const tone =
    available === undefined
      ? "text-admin-textMuted"
      : available === 0
        ? "text-red-600"
        : summary?.isLow
          ? "text-amber-600"
          : "text-green-700";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-admin-border pt-3 text-xs">
      <span className={`font-semibold ${tone}`}>
        พร้อมใช้ {available === undefined ? "—" : available.toLocaleString()} ใบ
      </span>
      {summary?.fallbackECouponToday > 0 && (
        <span className="text-admin-textMuted">
          e-coupon แทนกระดาษวันนี้ {summary.fallbackECouponToday.toLocaleString()} ใบ
        </span>
      )}
      <label className="flex items-center gap-1.5 text-admin-textMuted">
        เตือนเมื่อเหลือ ≤
        <input
          type="number"
          min="0"
          step="1"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="w-14 rounded-lg border border-admin-border px-2 py-1 text-xs text-admin-text"
        />
        {String(savedThreshold) !== threshold && (
          <button
            type="button"
            onClick={saveThreshold}
            disabled={savingThreshold}
            className="rounded-lg border border-admin-border px-2 py-1 hover:bg-admin-surfaceMuted disabled:opacity-50"
          >
            {savingThreshold ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        )}
      </label>
      <Link
        href={`/${adminKey}/admin/classroom/food/coupon-stock?shop=${encodeURIComponent(restaurantId)}`}
        className="ml-auto font-medium text-brand-primaryDark hover:underline"
      >
        ไปที่คลังคูปอง Stock →
      </Link>
    </div>
  );
}

export default function CouponSettingsCard({ restaurant, adminKey, menus = [], onSaved }) {
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null); // { title, body, patch }

  const restaurantId = String(restaurant?._id || "");
  const couponEnabled = !!restaurant?.couponEnabled;
  const usesCouponStock = !!restaurant?.usesCouponStock;
  const stockFallback = !!restaurant?.stockFallbackToECoupon;
  const showBarcode = !!restaurant?.showCouponBarcode;
  // learners only see priced menus, so flag active menus that have none
  const unpricedCount = menus.filter((m) => m.isActive !== false && !hasPrice(m.price)).length;

  async function patch(next) {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/food/restaurants/${restaurantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const out = await safeJson(res);
      if (!res.ok) {
        console.error(out);
        toast.error(out.error || "บันทึกการตั้งค่าคูปองไม่สำเร็จ");
        return;
      }
      onSaved?.(out.item);
    } catch (err) {
      console.error(err);
      toast.error("เกิดข้อผิดพลาดในการบันทึกการตั้งค่าคูปอง");
    } finally {
      setSaving(false);
    }
  }

  // turning ON saves right away; turning OFF asks first
  function onCouponChange(v) {
    if (v) {
      // still allowed; just say which menus learners won't see yet
      if (unpricedCount > 0) {
        toast.warning(
          `มีเมนูที่ยังไม่มีราคา ${unpricedCount} รายการ — จะไม่แสดงให้ผู้เรียนจนกว่าจะใส่ราคา`,
        );
      }
      return patch({ couponEnabled: true });
    }
    setConfirm({
      title: "ปิดการใช้งานคูปองของร้านนี้?",
      // the stored stock setting is kept and applies again when coupon is back on
      body: "ร้านนี้จะเลือกเป็นร้านคูปองใน Food Calendar ไม่ได้ และผู้เรียนจะสั่งล่วงหน้าจากร้านนี้ไม่ได้",
      patch: { couponEnabled: false },
    });
  }

  function onStockChange(v) {
    if (v) return patch({ usesCouponStock: true });
    setConfirm({
      title: "ปิดการใช้คูปอง stock ของร้านนี้?",
      body: "ออเดอร์ใหม่ของร้านนี้จะได้ e-coupon (9XP-XXXX) ที่ระบบออกให้ แทนการตัดรหัสจากคลังคูปอง stock",
      patch: { usesCouponStock: false },
    });
  }

  return (
    <div className="rounded-2xl bg-admin-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">การใช้งานคูปอง</h2>
        {saving && <span className="text-xs text-admin-textMuted">กำลังบันทึก...</span>}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <SettingRow
          title="เปิดให้เลือกเป็นร้านคูปอง"
          description="เปิดไว้เพื่อให้จัดร้านนี้เป็นร้านคูปองใน Food Calendar และให้ผู้เรียนสั่งอาหารล่วงหน้าจากมือถือได้"
          checked={couponEnabled}
          disabled={saving || !restaurantId}
          label="เปิดให้เลือกเป็นร้านคูปอง"
          onChange={onCouponChange}
        >
          {couponEnabled && unpricedCount > 0 && (
            <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
              มีเมนูที่ยังไม่มีราคา {unpricedCount} รายการ — จะไม่แสดงให้ผู้เรียนจนกว่าจะใส่ราคา
            </p>
          )}
        </SettingRow>

        <SettingRow
          title="ร้านนี้ใช้คูปอง stock (คูปองกระดาษของร้าน)"
          description="เปิดถ้าร้านส่งคูปองกระดาษมาให้ล่วงหน้า ระบบจะตัดรหัสจาก stock ที่นำเข้าไว้ ถ้าปิดระบบจะออก e-coupon (9XP-XXXX) ให้เอง"
          checked={usesCouponStock}
          disabled={saving || !couponEnabled}
          dimmed={!couponEnabled}
          label="ร้านนี้ใช้คูปอง stock"
          onChange={onStockChange}
        >
          {!couponEnabled ? (
            <p className="mt-2 text-[11px] text-admin-textMuted">
              {usesCouponStock
                ? "บันทึกไว้ว่าใช้คูปอง stock — จะมีผลเมื่อเปิดร้านคูปองอีกครั้ง"
                : "เปิดร้านคูปองก่อน จึงจะตั้งค่าคูปอง stock ได้"}
            </p>
          ) : usesCouponStock ? (
            <>
              <StockSummary restaurant={restaurant} adminKey={adminKey} onSaved={onSaved} />
              <div className="mt-3 flex items-start justify-between gap-4 border-t border-admin-border pt-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-admin-text">
                    เมื่อคูปองกระดาษหมด ให้ออก e-coupon จากระบบแทน
                  </div>
                  <p className="mt-0.5 text-[11px] text-admin-textMuted">
                    ใช้คูปองกระดาษก่อนเสมอ เมื่อไม่มีใบที่ใช้ได้ ผู้เรียนจะได้ e-coupon (9XP-XXXX)
                    ไปแสดงที่ร้านแทน และร้านไม่ขึ้นว่า &quot;คูปองหมด&quot;
                  </p>
                </div>
                <Toggle
                  checked={stockFallback}
                  disabled={saving}
                  label="เมื่อคูปองกระดาษหมด ให้ออก e-coupon จากระบบแทน"
                  onChange={(v) => patch({ stockFallbackToECoupon: v })}
                />
              </div>
              <BarcodeToggle
                checked={showBarcode}
                disabled={saving}
                eligible={stockFallback}
                onChange={(v) => patch({ showCouponBarcode: v })}
              />
            </>
          ) : (
            <>
              <p className="mt-2 text-[11px] text-admin-textMuted">
                ร้านนี้จะใช้ e-coupon (9XP-XXXX) ที่ระบบออกให้
              </p>
              <BarcodeToggle
                checked={showBarcode}
                disabled={saving}
                onChange={(v) => patch({ showCouponBarcode: v })}
              />
            </>
          )}
        </SettingRow>
      </div>

      {confirm && (
        <ConfirmOff
          confirm={confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const next = confirm.patch;
            setConfirm(null);
            patch(next);
          }}
        />
      )}
    </div>
  );
}
