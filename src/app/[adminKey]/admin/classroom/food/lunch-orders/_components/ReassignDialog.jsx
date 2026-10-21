"use client";

// R3: โมดัล "โยกไปร้านอื่น" — ผู้เรียน 1 คน (เมนู ⋯) หรือหลายคน (แถบเลือกหลายคน)
//   1) เปิดมา -> POST /reassign/preview (ไม่มีร้าน) ได้รายชื่อร้านของวันนั้น + สิทธิ์ของแต่ละคน
//   2) เลือกร้าน -> preview อีกครั้งพร้อมร้าน ได้ความจุ (คูปองกระดาษเหลือ / fallback) + สิทธิ์ต่อร้านนั้น
//   3) ยืนยัน -> POST /reassign เฉพาะคนที่โยกได้ — server ตรวจซ้ำทั้งหมด ไม่ผ่าน = ไม่มีใครถูกโยก
// สิทธิ์ทั้งหมดมาจาก server — ที่นี่แค่วาดตามผล preview
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, Store } from "lucide-react";

import { Modal } from "@/components/admin/lunch/LunchModals";
import { postLunchAdmin } from "@/components/admin/lunch/lunchApi";

const STATUS_TEXT = { pending: "รอสั่ง", ordered: "สั่งแล้ว", at_shop: "ไปสั่งที่ร้าน" };

function capacityLine(t) {
  if (!t?.usesCouponStock) return "e-coupon (ไม่จำกัดจำนวน)";
  const left = `คูปองกระดาษเหลือ ${t.stockAvailable ?? 0} ใบ`;
  if (t.stockFallback) {
    return t.generated > 0
      ? `${left} · กระดาษ ${t.paper} ใบ + e-coupon ${t.generated} ใบ (เปิด fallback)`
      : `${left} · เปิด fallback (หมดแล้วออก e-coupon แทน)`;
  }
  return `${left} · ไม่มี fallback`;
}

export default function ReassignDialog({ rows, onClose, onDone, onRefresh }) {
  const learners = useMemo(
    () => rows.map((r) => ({ studentId: r.studentId, classId: r.classId })),
    [rows],
  );
  const date = rows[0]?.dayYMD || "";

  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadPreview = useCallback(
    async (tid) => {
      setLoading(true);
      try {
        const res = await postLunchAdmin("/api/admin/lunch/reassign/preview", {
          learners,
          date,
          targetRestaurantId: tid || undefined,
        });
        setPreview(res);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [learners, date],
  );

  useEffect(() => {
    loadPreview(targetId);
  }, [loadPreview, targetId]);

  const eligible = (preview?.learners || []).filter((l) => l.eligible);
  // ร้านปัจจุบันของทุกคนที่โยกได้เป็นร้านเดียวกัน -> ไม่แสดงร้านนั้นเป็นตัวเลือก
  const currentIds = new Set(
    (preview?.learners || []).filter((l) => l.status).map((l) => l.fromRestaurantId || ""),
  );
  const onlyCurrent = currentIds.size === 1 ? [...currentIds][0] : "";
  const shops = (preview?.shops || []).filter((s) => !onlyCurrent || s.id !== onlyCurrent);

  const target = targetId ? preview?.target : null;
  const stockShort = target && target.available && !target.enough;
  const canConfirm =
    !busy &&
    !loading &&
    !preview?.window &&
    !!target?.enough &&
    eligible.length > 0;

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const res = await postLunchAdmin("/api/admin/lunch/reassign", {
        learners: eligible.map((l) => ({ studentId: l.studentId, classId: l.classId })),
        date,
        targetRestaurantId: targetId,
        reason: reason.trim(),
      });
      onDone(res);
    } catch (e) {
      // สถานะเปลี่ยนระหว่างนั้น — ไม่มีใครถูกโยก: แสดงข้อความ รีเฟรชรายการ และตรวจใหม่
      setError(e.message);
      onRefresh?.();
      loadPreview(targetId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={busy ? () => {} : onClose} testId="reassign-dialog" wide>
      <h3 className="flex items-center gap-2 pr-8 text-lg font-semibold text-admin-text">
        <ArrowRightLeft className="h-5 w-5" />
        โยกไปร้านอื่น ({rows.length} คน)
      </h3>

      {preview?.window ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {preview.window.message}
        </p>
      ) : null}

      {/* ร้านปลายทาง */}
      <div className="mt-4">
        <div className="mb-2 text-xs font-medium text-admin-text">ร้านปลายทาง</div>
        {!preview && loading ? (
          <p className="text-sm text-admin-textMuted">กำลังโหลด…</p>
        ) : shops.length === 0 ? (
          <p className="text-sm text-admin-textMuted">วันนี้ไม่มีร้านคูปองอื่นใน Food Calendar</p>
        ) : (
          <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto" data-testid="reassign-shops">
            {shops.map((s) => {
              const on = s.id === targetId;
              return (
                <label
                  key={s.id}
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                    !s.available
                      ? "cursor-not-allowed border-admin-border bg-admin-surfaceMuted/60 text-admin-textMuted"
                      : on
                        ? "cursor-pointer border-brand-primary bg-brand-primary/10"
                        : "cursor-pointer border-admin-border hover:bg-admin-surfaceMuted"
                  }`}
                >
                  <input
                    type="radio"
                    name="reassign-target"
                    className="mt-1"
                    disabled={!s.available || busy}
                    checked={on}
                    onChange={() => {
                      setError("");
                      setTargetId(s.id);
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Store className="h-3.5 w-3.5 shrink-0" />
                      {s.name}
                    </span>
                    <span className="block text-xs text-admin-textMuted">
                      {s.available
                        ? s.usesCouponStock
                          ? `stock · เหลือ ${s.stockAvailable ?? 0} ใบ${s.stockFallback ? " · fallback e-coupon" : ""}`
                          : "e-coupon"
                        : s.reasonLabel}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {target ? (
        <p
          className={`mt-3 rounded-xl px-3 py-2 text-sm ${
            stockShort ? "bg-red-50 text-red-700" : "bg-admin-surfaceMuted text-admin-text"
          }`}
          data-testid="reassign-capacity"
        >
          {stockShort ? (
            <span className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              คูปองกระดาษไม่พอ: ต้องการ {target.needed} ใบ เหลือ {target.stockAvailable ?? 0} ใบ
              (ร้านนี้ไม่มี fallback) — โยกไม่ได้
            </span>
          ) : target.available ? (
            capacityLine(target)
          ) : (
            target.reasonLabel
          )}
        </p>
      ) : null}

      {/* ผู้เรียนที่เลือก */}
      <div className="mt-4">
        <div className="mb-2 text-xs font-medium text-admin-text">
          ผู้เรียน · โยกได้ {eligible.length} / {rows.length} คน
        </div>
        <ul
          className="flex max-h-48 flex-col divide-y divide-admin-border overflow-y-auto rounded-xl border border-admin-border"
          data-testid="reassign-learners"
        >
          {(preview?.learners || []).map((l) => (
            <li key={`${l.classId}:${l.studentId}`} className="px-3 py-2 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className={l.eligible ? "text-admin-text" : "text-admin-textMuted"}>
                  {l.name || "-"}
                  {l.nickname ? ` (${l.nickname})` : ""}
                </span>
                <span className="shrink-0 text-xs text-admin-textMuted">
                  {STATUS_TEXT[l.status] || ""}
                  {l.fromRestaurantName ? ` · ${l.fromRestaurantName}` : ""}
                </span>
              </div>
              {!l.eligible ? (
                <div className="text-xs text-red-600">ไม่โยก: {l.message}</div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <label className="mt-4 block text-xs font-medium text-admin-text">
        เหตุผล (ไม่บังคับ)
        <input
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
          placeholder="เช่น ร้านเดิมของหมด"
          className="mt-1.5 h-10 w-full rounded-xl border border-admin-border bg-white px-3 text-sm text-admin-text outline-none focus:border-brand-primary"
        />
      </label>

      <ul className="mt-3 flex flex-col gap-1.5 text-xs text-amber-800">
        <li className="rounded-xl bg-amber-50 px-3 py-2">
          ออเดอร์เดิมจะถูกยกเลิก (กระดาษที่ยังไม่ส่งมอบคืนคลัง / ส่งมอบแล้วต้องรับคืน / e-coupon ถูก void)
          และผู้เรียนได้คูปองของร้านใหม่แบบ “ไปสั่งที่ร้าน” งบ 180 บาท
        </li>
      </ul>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-xl border border-admin-border px-5 py-2.5 text-sm text-admin-text hover:bg-admin-surfaceMuted disabled:opacity-50"
        >
          ปิด
        </button>
        <button
          type="button"
          data-testid="reassign-confirm"
          onClick={confirm}
          disabled={!canConfirm}
          className="rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-[#0D1B2A] hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "กำลังโยก…" : `ยืนยันโยก ${eligible.length} คน`}
        </button>
      </div>
    </Modal>
  );
}
