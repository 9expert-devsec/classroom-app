"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { safeJson } from "../menuUi";
import { idStr } from "./optionSetUi";

const SHOW = 3;

function ModeCard({ value, mode, setMode, title, body }) {
  const on = mode === value;
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${
        on ? "border-brand-primary bg-brand-primary/5" : "border-admin-border hover:bg-admin-surfaceMuted/60"
      }`}
    >
      <input
        type="radio"
        name="option-set-delete-mode"
        value={value}
        checked={on}
        onChange={() => setMode(value)}
        className="mt-0.5 accent-[#0099CC]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-admin-text">{title}</span>
        <span className="block text-xs text-admin-textMuted">{body}</span>
      </span>
    </label>
  );
}

/** Mounted only while open. DELETE ?mode=remove|detach; onDeleted() after success. */
export default function OptionSetDeleteDialog({ set, open = true, onClose, onDeleted }) {
  const [mode, setMode] = useState("remove");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const menus = set.menus || [];
  const n = menus.length;
  const more = n - SHOW;

  async function confirmDelete() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/food/option-sets/${idStr(set._id)}?mode=${n ? mode : "remove"}`, {
        method: "DELETE",
      });
      const out = await safeJson(res);
      if (!res.ok) {
        setError(out.error || "ลบชุดตัวเลือกไม่สำเร็จ");
        return;
      }
      toast.success("ลบชุดตัวเลือกเรียบร้อย");
      onDeleted?.();
    } catch (err) {
      console.error(err);
      setError("ลบชุดตัวเลือกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="flex max-h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] max-w-[580px] flex-col gap-0 rounded-2xl bg-white p-0">
        <div className="border-b border-admin-border px-5 py-4 pr-12">
          <DialogTitle className="text-lg">ลบชุด “{set.name}”?</DialogTitle>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {n === 0 ? (
            <DialogDescription className="text-sm text-admin-text">
              ชุดนี้ยังไม่ได้ใช้กับเมนูไหน ลบแล้วกู้คืนไม่ได้
            </DialogDescription>
          ) : (
            <>
              <DialogDescription className="text-sm text-admin-text">
                <span>
                  ชุดนี้ใช้อยู่ใน <strong>{n} เมนู</strong>:{" "}
                  {(expanded ? menus : menus.slice(0, SHOW)).map((m) => m.name).join(", ")}
                  {!expanded && more > 0 && (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={() => setExpanded(true)}
                        className="text-brand-primaryDark hover:underline"
                      >
                        และอีก {more}
                      </button>
                    </>
                  )}
                </span>
              </DialogDescription>

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold text-admin-text">ตัวเลือกในเมนูที่ผูกอยู่</legend>
                <ModeCard
                  value="remove"
                  mode={mode}
                  setMode={setMode}
                  title="เอาออกจากทุกเมนูด้วย (ค่าเริ่มต้น)"
                  body={`กลุ่ม “${set.name}” จะหายจากทั้ง ${n} เมนู`}
                />
                <ModeCard
                  value="detach"
                  mode={mode}
                  setMode={setMode}
                  title="เก็บไว้ในเมนูเป็นกลุ่มเฉพาะเมนู"
                  body={`ทั้ง ${n} เมนูยังมีตัวเลือกนี้เหมือนเดิม (รวมราคาที่ปรับเองและตัวที่ซ่อนไว้) แต่จากนี้ต้องแก้ทีละเมนู`}
                />
              </fieldset>

              <p className="text-xs text-admin-textMuted">
                ออเดอร์ที่สั่งไปแล้วไม่กระทบไม่ว่าเลือกแบบไหน · ลบแล้วกู้คืนไม่ได้
              </p>
            </>
          )}

          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-admin-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-admin-border bg-white px-5 py-2.5 text-sm font-medium hover:bg-admin-surfaceMuted disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {n === 0
              ? "ลบชุด"
              : mode === "remove"
                ? `ลบชุดและเอาออกจาก ${n} เมนู`
                : `ลบชุดและเก็บไว้ใน ${n} เมนู`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
