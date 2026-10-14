"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { safeJson } from "../menuUi";

/**
 * Mounted only while open. A set used by a Food Calendar day from today on
 * can't be deleted (the API refuses with 409); past days don't block.
 */
export default function SetDeleteDialog({ set, menuCount, onClose, onDeleted }) {
  const { adminKey } = useParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // null = still checking
  const [blockingDates, setBlockingDates] = useState(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/food/sets/${set._id}`, { cache: "no-store" });
        const out = await safeJson(res);
        if (!ignore) setBlockingDates(res.ok ? out.upcomingDates || [] : []);
      } catch (err) {
        console.error(err);
        if (!ignore) setBlockingDates([]);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [set._id]);

  const blocked = (blockingDates?.length || 0) > 0;

  async function confirmDelete() {
    if (busy || blocked) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/food/sets/${set._id}`, { method: "DELETE" });
      const out = await safeJson(res);
      if (res.status === 409 && Array.isArray(out.upcomingDates)) {
        // a calendar day started using the set since the check
        setBlockingDates(out.upcomingDates);
        return;
      }
      if (!res.ok) {
        setError(out.error || "ลบชุดเมนูไม่สำเร็จ");
        return;
      }
      toast.success("ลบชุดเมนูเรียบร้อย");
      onDeleted();
    } catch (err) {
      console.error(err);
      setError("ลบชุดเมนูไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md rounded-2xl bg-white">
        <DialogTitle className="text-lg">ยืนยันการลบชุดเมนู</DialogTitle>

        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-500" />
          <div className="min-w-0 flex-1 space-y-3">
            <DialogDescription className="font-semibold text-admin-text">
              คุณต้องการลบชุดเมนูนี้ใช่หรือไม่?
            </DialogDescription>
            <div className="rounded-xl bg-admin-surfaceMuted p-3">
              <div className="break-words font-semibold text-admin-text">{set.name}</div>
              <div className="text-xs text-admin-textMuted">มีเมนูในชุดนี้ {menuCount} รายการ</div>
            </div>
          </div>
        </div>

        {blocked && (
          <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <div className="font-medium">
              ชุดนี้ถูกใช้ใน Food Calendar {blockingDates.length} วัน — เปลี่ยนชุดในวันดังกล่าวก่อนจึงจะลบได้
            </div>
            <ul className="max-h-32 space-y-0.5 overflow-y-auto pl-1 text-xs">
              {blockingDates.map((d) => (
                <li key={d} className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
                  {d}
                </li>
              ))}
            </ul>
            <Link
              href={`/${adminKey}/admin/classroom/food/calendar`}
              className="inline-block text-xs font-semibold text-brand-primaryDark hover:underline"
            >
              ไปที่ Food Calendar →
            </Link>
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
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={busy || blocked || blockingDates === null}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {(busy || blockingDates === null) && <Loader2 className="h-4 w-4 animate-spin" />}
            ลบชุดเมนู
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
