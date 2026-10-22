"use client";

// R5-3d: "รับคืนคูปองค้างจอง" — ใบจองที่วันเรียนผ่านไปแล้วแต่ผู้เรียนไม่มารับคูปองกระดาษ
// แอดมินเลือกใบที่ได้กระดาษกลับมาแล้ว (ใบที่หายใช้ "ยกเลิก (void)" รายใบตามเดิม)
// ออเดอร์ของวันนั้นไม่ถูกแก้ — server แค่ประทับ "ไม่มารับคูปอง" แล้วคืนรหัสเข้าคลัง
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { isLotCancelled, lotApi, lotLabel, safeJson } from "./stockUi";

/**
 * Mounted only while open.
 * lot = lot card (lotId, importBatch, lotStatus) · codeId = เปิดจากแถวในตาราง (แสดงเฉพาะใบนั้น)
 */
export default function LotStaleDialog({ restaurantId, lot, codeId = "", onClose, onDone }) {
  const [items, setItems] = useState(null);
  const [checked, setChecked] = useState(() => new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const cancelled = isLotCancelled(lot);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ restaurantId, lotId: lot.lotId, stale: "1" });
      if (codeId) qs.set("codeId", codeId);
      const res = await fetch(`/api/admin/food/coupon-stock?${qs.toString()}`, { cache: "no-store" });
      const data = await safeJson(res);
      if (!res.ok) {
        setError(data.error || "โหลดรายการค้างจองไม่สำเร็จ");
        return;
      }
      const list = data.items || [];
      setItems(list);
      setChecked(new Set(list.map((it) => it._id)));
      setConfirmed(false);
    } catch (err) {
      console.error(err);
      setError("โหลดรายการค้างจองไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, lot.lotId, codeId]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allChecked = !!items?.length && checked.size === items.length;
  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set((items || []).map((it) => it._id)));
  }

  async function submit() {
    if (busy || checked.size === 0 || !confirmed) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { ok, data } = await lotApi("/release-stale", { lotId: lot.lotId, codeIds: [...checked] });
      if (ok) {
        const parts = [];
        if (data.available) parts.push(`กลับเข้าคลัง ${data.available} ใบ`);
        if (data.voided) parts.push(`ถูกยกเลิก ${data.voided} ใบ (ล็อตถูกยกเลิก)`);
        toast.success(`รับคืนแล้ว ${data.released} ใบ${parts.length ? ` — ${parts.join(" · ")}` : ""}`);
        onDone();
        return;
      }
      if (data.code === "stale_changed") {
        setNotice("รายการค้างจองเปลี่ยนไประหว่างนี้ — โหลดรายการใหม่แล้ว กรุณาตรวจสอบอีกครั้ง");
        await load();
        return;
      }
      setError(data.error || "รับคืนไม่สำเร็จ");
    } catch (err) {
      console.error(err);
      setError("รับคืนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const learnerOf = (it) =>
    [it.holderName, it.nickname ? `(${it.nickname})` : ""].filter(Boolean).join(" ") || "—";
  const classOf = (it) => [it.courseName, it.roomName].filter(Boolean).join(" · ") || "—";

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-xl rounded-2xl bg-white">
        <DialogTitle className="text-lg">รับคืนคูปองค้างจอง</DialogTitle>

        <div className="rounded-xl bg-admin-surfaceMuted p-3">
          <div className="break-words font-semibold text-admin-text">{lotLabel(lot.importBatch)}</div>
          <div className="text-xs text-admin-textMuted">
            {items ? `ค้างจอง ${items.length} ใบ` : "กำลังโหลด..."}
          </div>
        </div>

        <DialogDescription className="flex gap-2 text-sm text-admin-text">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-admin-textMuted" />
          วันเรียนผ่านไปแล้วแต่ผู้เรียนไม่ได้มารับคูปอง — กดรับคืนเมื่อได้กระดาษกลับมาแล้ว
        </DialogDescription>

        {cancelled && (
          <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            ล็อตนี้ถูกยกเลิก — คูปองที่รับคืนจะถูกยกเลิก ไม่กลับเข้าคลัง
          </div>
        )}

        {notice && (
          <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            {notice}
          </div>
        )}

        {loading && !items ? (
          <div className="flex items-center gap-2 text-sm text-admin-textMuted">
            <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลดรายการ...
          </div>
        ) : items && items.length === 0 ? (
          <p className="rounded-xl bg-admin-surfaceMuted p-3 text-sm text-admin-textMuted">
            ไม่มีคูปองค้างจองในล็อตนี้แล้ว
          </p>
        ) : items ? (
          <div className="max-h-72 overflow-auto rounded-xl border border-admin-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-admin-surfaceMuted text-left text-admin-textMuted">
                <tr>
                  <th className="w-8 px-2 py-2">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      aria-label="เลือกทั้งหมด"
                    />
                  </th>
                  <th className="px-2 py-2 font-medium">รหัส</th>
                  <th className="px-2 py-2 font-medium">วันเรียน</th>
                  <th className="px-2 py-2 font-medium">ผู้เรียน</th>
                  <th className="px-2 py-2 font-medium">ห้อง / คลาส</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it._id} className="border-t border-admin-border/60">
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={checked.has(it._id)}
                        onChange={() => toggle(it._id)}
                        aria-label={`เลือก ${it.code}`}
                      />
                    </td>
                    <td className="px-2 py-1.5 font-mono">{it.code}</td>
                    <td className="px-2 py-1.5">{it.dayYMD}</td>
                    <td className="px-2 py-1.5">{learnerOf(it)}</td>
                    <td className="px-2 py-1.5">{classOf(it)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!!items?.length && (
          <label className="flex items-start gap-2 text-sm text-admin-text">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            ได้รับคูปองกระดาษคืนครบตามที่เลือกแล้ว
          </label>
        )}

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl border border-admin-border bg-white py-2.5 text-sm font-medium hover:bg-admin-surfaceMuted disabled:opacity-50"
          >
            ปิด
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || loading || checked.size === 0 || !confirmed}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-primaryDark py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            รับคืน {checked.size} ใบ
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
