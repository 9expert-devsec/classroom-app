"use client";

// R5-3: "กู้คืนล็อต" — ไม่มี preview ของการกู้คืน จึงบอกจำนวนที่คืนเข้าคลังใน toast หลังทำรายการ
// (server คืนเฉพาะรหัสที่ถูก void เพราะการยกเลิกล็อต — รหัสที่ยกเลิกรายใบไว้ก่อนคงเดิม)
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { lotApi, lotLabel } from "./stockUi";

/** Mounted only while open. onDone() after a successful restore. */
export default function LotRestoreDialog({ lot, today, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const expired = !!lot.expiresYMD && !!today && lot.expiresYMD < today;

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { ok, data } = await lotApi("/restore", { lotId: lot.lotId });
      if (!ok) {
        setError(data.error || "กู้คืนล็อตไม่สำเร็จ");
        return;
      }
      toast.success(`กู้คืนล็อตแล้ว — รหัสกลับเข้าคลัง ${data.restored} ใบ`);
      if (data.expiredWarning) {
        toast.warning("ล็อตนี้หมดอายุแล้ว รหัสที่กู้คืนจะนับเป็นหมดอายุจนกว่าจะแก้วันหมดอายุ");
      }
      onDone();
    } catch (err) {
      console.error(err);
      setError("กู้คืนล็อตไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md rounded-2xl bg-white">
        <DialogTitle className="text-lg">กู้คืนล็อต</DialogTitle>

        <div className="rounded-xl bg-admin-surfaceMuted p-3">
          <div className="break-words font-semibold text-admin-text">{lotLabel(lot.importBatch)}</div>
          <div className="text-xs text-admin-textMuted">
            หมดอายุ {lot.expiresYMD || "—"} · {lot.total} ใบ
          </div>
        </div>

        <DialogDescription className="text-sm text-admin-text">
          ล็อตจะกลับมาใช้งานได้ และรหัสที่ถูกยกเลิกพร้อมล็อตจะกลับเข้าคลัง (จำนวนจะแจ้งหลังกู้คืน)
          — รหัสที่ยกเลิกรายใบไว้ก่อนหน้าจะคงสถานะยกเลิก
        </DialogDescription>

        {expired && (
          <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            ล็อตนี้หมดอายุแล้ว ({lot.expiresYMD}) — รหัสที่กู้คืนจะนับเป็นหมดอายุจนกว่าจะแก้วันหมดอายุของล็อต
          </div>
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
            onClick={confirm}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-primaryDark py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            กู้คืนล็อต
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
