"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import TextInput from "@/components/ui/TextInput";
import { AlertTriangle } from "lucide-react";

async function safeJson(res) {
  const t = await res.text().catch(() => "");
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
}

export default function CouponStockCard({ restaurant, adminKey, onSaved }) {
  const restaurantId = String(restaurant?._id || "");

  const [summary, setSummary] = useState(null);
  const [threshold, setThreshold] = useState(
    String(restaurant?.couponStockLowThreshold ?? 5),
  );
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await fetch(
        `/api/admin/food/coupon-stock/summary?restaurantId=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store" },
      );
      const data = await safeJson(res);
      if (res.ok) setSummary(data);
    } catch (err) {
      console.error(err);
    }
  }, [restaurantId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setThreshold(String(restaurant?.couponStockLowThreshold ?? 5));
  }, [restaurant?.couponStockLowThreshold]);

  async function saveThreshold() {
    const n = Number(threshold);
    if (!Number.isFinite(n) || n < 0) {
      return alert("เกณฑ์เตือนต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/food/restaurants/${restaurantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponStockLowThreshold: Math.floor(n) }),
      });
      const out = await safeJson(res);
      if (!res.ok) {
        console.error(out);
        return alert(out.error || "บันทึกเกณฑ์เตือนไม่สำเร็จ");
      }
      onSaved?.(out.item);
      await load();
    } catch (err) {
      console.error(err);
      alert("บันทึกเกณฑ์เตือนไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const available = summary?.availableNotExpired ?? null;
  const isLow = !!summary?.isLow;

  return (
    <div className="rounded-2xl bg-admin-surface p-4 shadow-slate-950/20">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">คูปอง Stock</h2>
        <Link
          href={`/${adminKey}/admin/classroom/food/coupon-stock`}
          className="text-xs text-brand-primary hover:underline"
        >
          ไปหน้าคลังคูปอง →
        </Link>
      </div>

      {isLow && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <span className="text-[11px] text-amber-800">
            คูปองพร้อมใช้เหลือน้อย ควรรับล็อตใหม่จากร้าน
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div className="rounded-xl border border-admin-border bg-white px-4 py-2">
          <div className="text-[11px] text-admin-textMuted">พร้อมใช้</div>
          <div
            className={`text-2xl font-semibold ${
              isLow ? "text-amber-700" : "text-green-700"
            }`}
          >
            {available === null ? "—" : available}
          </div>
        </div>

        <label className="block text-sm">
          <span className="text-admin-text">ต่ำสุดที่เตือน</span>
          <div className="mt-1 flex items-center gap-2">
            <div className="w-24">
              <TextInput
                type="number"
                min="0"
                step="1"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={saveThreshold}
              disabled={saving}
              className="rounded-xl border border-admin-border bg-white px-3 py-2 text-xs font-medium hover:bg-admin-surfaceMuted disabled:opacity-60"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </label>
      </div>
    </div>
  );
}
