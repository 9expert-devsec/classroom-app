"use client";

import { useState } from "react";
import Toggle from "./Toggle";

async function safeJson(res) {
  const t = await res.text().catch(() => "");
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
}

export default function CouponSettingsCard({ restaurant, onSaved }) {
  const [saving, setSaving] = useState(false);

  const restaurantId = String(restaurant?._id || "");
  const couponEnabled = !!restaurant?.couponEnabled;
  const usesCouponStock = !!restaurant?.usesCouponStock;

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
        return alert(out.error || "บันทึกการตั้งค่าคูปองไม่สำเร็จ");
      }
      onSaved?.(out.item);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึกการตั้งค่าคูปอง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-admin-surface p-4 shadow-slate-950/20">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">การใช้งานคูปอง</h2>
        {saving && (
          <span className="text-xs text-admin-textMuted">กำลังบันทึก...</span>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-admin-border bg-white p-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-admin-text">
              เปิดให้เลือกเป็นร้านคูปอง
            </div>
            <p className="mt-0.5 text-[11px] text-admin-textMuted">
              เปิดไว้เพื่อให้จัดร้านนี้เป็นร้านคูปองใน Food Calendar
              และให้ผู้เรียนสั่งอาหารล่วงหน้าจากมือถือได้
            </p>
          </div>
          <Toggle
            checked={couponEnabled}
            disabled={saving}
            label="เปิดให้เลือกเป็นร้านคูปอง"
            onChange={(v) => patch({ couponEnabled: v })}
          />
        </div>

        <div
          className={[
            "flex items-start justify-between gap-4 rounded-2xl border border-admin-border bg-white p-3",
            couponEnabled ? "" : "opacity-60",
          ].join(" ")}
        >
          <div className="min-w-0">
            <div className="text-sm font-semibold text-admin-text">
              ร้านนี้ใช้คูปอง stock (คูปองกระดาษของร้าน)
            </div>
            <p className="mt-0.5 text-[11px] text-admin-textMuted">
              เปิดถ้าร้านส่งคูปองกระดาษมาให้ล่วงหน้า ระบบจะตัดรหัสจาก stock
              ที่นำเข้าไว้ ถ้าปิดระบบจะออก e-coupon (9XP-XXXX) ให้เอง
            </p>
          </div>
          <Toggle
            checked={usesCouponStock}
            disabled={saving || !couponEnabled}
            label="ร้านนี้ใช้คูปอง stock"
            onChange={(v) => patch({ usesCouponStock: v })}
          />
        </div>
      </div>
    </div>
  );
}
