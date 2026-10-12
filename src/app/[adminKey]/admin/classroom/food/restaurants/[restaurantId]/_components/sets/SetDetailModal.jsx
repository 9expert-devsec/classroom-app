"use client";

import { Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { MenuImage } from "../MenuBits";
import { formatPrice, hasPrice } from "../menuUi";
import { SetAvatar } from "./setUi";

/** read-only view of a set (no set image: sets have none) */
export default function SetDetailModal({ set, items, onClose, onEdit, onDelete }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] w-[calc(100vw-2rem)] max-w-xl flex-col gap-4 rounded-2xl bg-white">
        <DialogDescription className="sr-only">รายละเอียดชุดเมนู</DialogDescription>
        <div className="text-base font-semibold">ดูรายละเอียดชุดเมนู</div>

        <div className="flex flex-wrap items-center gap-3">
          <SetAvatar name={set.name} size="lg" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-lg">{set.name}</DialogTitle>
            <div className="text-sm text-admin-textMuted">รวม {items.length} เมนู</div>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm text-brand-primaryDark hover:bg-brand-primary/10"
            >
              <Pencil className="h-4 w-4" /> แก้ไข
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" /> ลบชุดเมนู
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-admin-border">
          <div className="border-b border-admin-border px-3 py-2 text-sm font-semibold">รายการเมนูในชุด</div>
          {items.map((m, i) => {
            const off = m.isActive === false;
            return (
              <div
                key={String(m._id)}
                className={`flex items-center gap-3 border-b border-admin-border/60 px-3 py-2 last:border-b-0 ${
                  off ? "text-admin-textMuted" : ""
                }`}
              >
                <span className="w-5 text-center text-xs text-admin-textMuted">{i + 1}</span>
                <MenuImage menu={m} sizes="40px" className={`h-10 w-10 flex-shrink-0 ${off ? "opacity-50 grayscale" : ""}`} />
                <span className="min-w-0 flex-1 truncate text-sm" title={m.name}>
                  {m.name}
                </span>
                {off && (
                  <span className="rounded bg-slate-200 px-1.5 text-[10px] text-slate-600">ปิดใช้งาน</span>
                )}
                {hasPrice(m.price) && (
                  <span className="text-sm text-admin-textMuted">{formatPrice(m.price)}</span>
                )}
              </div>
            );
          })}
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-admin-textMuted">ชุดนี้ยังไม่มีเมนู</p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-admin-border bg-white px-5 py-2 text-sm font-medium hover:bg-admin-surfaceMuted"
          >
            ปิด
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
