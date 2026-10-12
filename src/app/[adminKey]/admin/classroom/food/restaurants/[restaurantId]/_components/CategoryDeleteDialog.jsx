"use client";

import { useState } from "react";
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { safeJson } from "./menuUi";

/** Mounted only while open. Deleting keeps the menus; it only detaches them. */
export default function CategoryDeleteDialog({ category, menuCount, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirmDelete() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/food/categories/${category._id}`, {
        method: "DELETE",
      });
      const out = await safeJson(res);
      if (!res.ok) {
        setError(out.error || "ลบหมวดหมู่ไม่สำเร็จ");
        return;
      }
      onDeleted(out);
    } catch (err) {
      console.error(err);
      setError("ลบหมวดหมู่ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md rounded-2xl bg-white">
        <DialogTitle className="text-lg">ยืนยันการลบหมวดหมู่</DialogTitle>

        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-500" />
          <div className="min-w-0 flex-1 space-y-3">
            <DialogDescription className="font-semibold text-admin-text">
              คุณต้องการลบหมวดหมู่นี้ใช่หรือไม่?
            </DialogDescription>
            <div className="rounded-xl bg-admin-surfaceMuted p-3">
              <div className="break-words font-semibold text-admin-text">{category.name}</div>
              <div className="text-xs text-admin-textMuted">
                มีเมนูที่ใช้ในหมวดหมู่นี้ {menuCount} รายการ
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          หากลบหมวดหมู่ เมนูที่อยู่ในหมวดหมู่นี้จะถูกนำออกจากหมวดหมู่
          และจะไม่แสดงในฟอร์มเลือกหมวดหมู่
        </div>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl border border-admin-border bg-white py-2.5 text-sm font-medium hover:bg-admin-surfaceMuted disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            ลบหมวดหมู่
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
