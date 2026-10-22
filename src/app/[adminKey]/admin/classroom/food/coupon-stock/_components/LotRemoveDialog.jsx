"use client";

// R5-3: "ลบ / ยกเลิกล็อต" — เปิดมาขอ /lots/impact (action delete) แล้ววาดตาม decision ที่ server ตัดสิน
//   delete : ไม่เคยใช้ -> ลบล็อต + รหัสทั้งหมดถาวร
//   cancel : เคยใช้   -> ยกเลิกล็อต (void ใบที่ยังไม่ใช้ · ใบที่จองไว้ใช้ต่อได้ · ใบรอคืนจะถูก void ตอนคืน)
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { IMPACT_CHANGED_MSG, lotApi, lotLabel } from "./stockUi";

const MAX_REASON = 500;

/** Mounted only while open. onDone({ decision }) after a successful delete / cancel. */
export default function LotRemoveDialog({ lot, onClose, onDone }) {
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const { ok, data } = await lotApi("/impact", { lotId: lot.lotId, action: "delete" });
      if (!ok) {
        setError(data.error || "ตรวจสอบผลกระทบไม่สำเร็จ");
        setImpact(null);
        return;
      }
      setImpact(data.impact);
    } catch (err) {
      console.error(err);
      setError("ตรวจสอบผลกระทบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [lot.lotId]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  async function confirm() {
    if (busy || !impact?.ok) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { ok, data } = await lotApi("/delete-or-cancel", {
        lotId: lot.lotId,
        impactHash: impact.impactHash,
        reason: reason.trim(),
      });
      if (ok) {
        if (data.decision === "delete") {
          toast.success(`ลบล็อตถาวรแล้ว (${data.deleted} ใบ)`);
        } else {
          toast.success(`ยกเลิกล็อตแล้ว — ยกเลิกรหัสที่ยังไม่ใช้ ${data.voided} ใบ`);
        }
        onDone({ decision: data.decision });
        return;
      }
      if (data.code === "impact_changed") {
        setNotice(IMPACT_CHANGED_MSG);
        await loadPreview();
        return;
      }
      setError(data.error || "ทำรายการไม่สำเร็จ");
    } catch (err) {
      console.error(err);
      setError("ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const isDelete = impact?.decision === "delete";
  const c = impact?.cancel;
  const title = !impact ? "ลบ / ยกเลิกล็อต" : isDelete ? "ลบล็อตถาวร" : "ยกเลิกล็อต";

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md rounded-2xl bg-white">
        <DialogTitle className="text-lg">{title}</DialogTitle>

        <div className="rounded-xl bg-admin-surfaceMuted p-3">
          <div className="break-words font-semibold text-admin-text">{lotLabel(lot.importBatch)}</div>
          <div className="text-xs text-admin-textMuted">
            หมดอายุ {lot.expiresYMD || "—"} · {impact?.counts?.total ?? lot.total} ใบ
          </div>
        </div>

        {notice && (
          <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            {notice}
          </div>
        )}

        {loading && !impact ? (
          <div className="flex items-center gap-2 text-sm text-admin-textMuted">
            <Loader2 className="h-4 w-4 animate-spin" /> กำลังตรวจสอบผลกระทบ...
          </div>
        ) : impact && isDelete ? (
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-500" />
            <DialogDescription className="text-sm text-admin-text">
              ล็อตนี้ยังไม่เคยถูกใช้ จะลบล็อตและรหัสทั้งหมด {impact.counts.total} ใบออกถาวร
            </DialogDescription>
          </div>
        ) : impact ? (
          <div className="space-y-3">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0 text-amber-500" />
              <DialogDescription className="font-semibold text-admin-text">
                ล็อตนี้เคยถูกใช้แล้ว จึงลบไม่ได้ — ระบบจะยกเลิกล็อตแทน
              </DialogDescription>
            </div>
            <ul className="list-disc space-y-1 pl-9 text-sm text-admin-text">
              <li>ยกเลิกรหัสที่ยังไม่ใช้ {c.voidCount} ใบ</li>
              <li>รหัสที่จองไว้ {c.stillAssigned} ใบยังใช้ต่อได้ตามเดิม</li>
              <li>รอคืนเข้าคลัง {c.awaitingReturnOut} ใบ (เมื่อคืนจะถูกยกเลิกอัตโนมัติ)</li>
              <li>ส่งมอบแล้ว {c.handedOut} ใบไม่กระทบ</li>
            </ul>
            <label className="block">
              <span className="text-sm font-medium text-admin-text">เหตุผล (ไม่บังคับ)</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
                rows={2}
                placeholder="เช่น ร้านเปลี่ยนคูปองชุดใหม่"
                className="mt-1 w-full resize-y rounded-xl border border-admin-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
            </label>
          </div>
        ) : null}

        {(impact?.errors || []).map((e) => (
          <div key={e.code} className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {e.message}
          </div>
        ))}
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
            onClick={confirm}
            disabled={busy || loading || !impact?.ok}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {isDelete ? "ลบล็อตถาวร" : "ยกเลิกล็อต"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
