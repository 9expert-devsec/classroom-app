"use client";

// R5-4: หน้าต่างจัดการรหัสรายใบ (แทน window.prompt / confirm เดิม) — layout เดียวกับ LotRemoveDialog
//   void          : ยกเลิกรหัส (ต้องมีเหตุผล) — รหัสที่ยกเลิกแล้วลบถาวรไม่ได้ ต้องนำกลับเข้าคลังก่อน
//   note          : แก้ / ล้างหมายเหตุ
//   delete        : ลบถาวร — server ยังตรวจว่าไม่เคยผูกกับออเดอร์ (409 ถ้าไม่ผ่าน)
//   unvoid        : นำกลับเข้าคลัง (ล็อตที่ถูกยกเลิก ปุ่มในเมนูถูกปิดไว้ตั้งแต่ R5-2)
//   confirmReturn : ยืนยันรับคูปองกระดาษคืน
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  lotLabel,
  safeJson,
  STALE_ASSIGNED_LABEL,
  STALE_ASSIGNED_STYLE,
  STATUS_LABELS,
  STATUS_STYLES,
} from "./stockUi";

const MAX_TEXT = 500;

const VOID_REASONS = ["กระดาษหาย", "กระดาษชำรุด", "ร้านแจ้งยกเลิก", "นำเข้าซ้ำ / ผิด"];

const KINDS = {
  void: {
    title: "ยกเลิกรหัสคูปอง",
    button: "ยกเลิกรหัส",
    danger: true,
    fail: "ยกเลิกรหัสไม่สำเร็จ",
    success: (code) => `ยกเลิกรหัส ${code} แล้ว`,
  },
  note: {
    title: "แก้หมายเหตุ",
    button: "บันทึก",
    fail: "บันทึกหมายเหตุไม่สำเร็จ",
    success: () => "บันทึกหมายเหตุแล้ว",
  },
  delete: {
    title: "ลบรหัสถาวร",
    button: "ลบถาวร",
    danger: true,
    fail: "ลบไม่สำเร็จ",
    success: (code) => `ลบรหัส ${code} ถาวรแล้ว`,
  },
  unvoid: {
    title: "นำกลับเข้าคลัง",
    button: "นำกลับเข้าคลัง",
    icon: RotateCcw,
    fail: "นำกลับเข้าคลังไม่สำเร็จ",
    success: (code) => `นำรหัส ${code} กลับเข้าคลังแล้ว`,
  },
  confirmReturn: {
    title: "ยืนยันรับคืน",
    button: "ยืนยันรับคืน",
    fail: "ยืนยันรับคืนไม่สำเร็จ",
    success: (code) => `รับคูปอง ${code} คืนแล้ว`,
  },
};

function StatusBadge({ row }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        row.staleAssigned ? STALE_ASSIGNED_STYLE : STATUS_STYLES[row.status] || ""
      }`}
    >
      {row.staleAssigned ? STALE_ASSIGNED_LABEL : STATUS_LABELS[row.status] || row.status}
    </span>
  );
}

/** Mounted only while open. onDone() after a successful action. */
export default function CodeActionDialog({ kind, row, onClose, onDone }) {
  const cfg = KINDS[kind];
  const [text, setText] = useState(kind === "note" ? row.note || "" : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const textRef = useRef(null);

  const hasText = kind === "void" || kind === "note";
  const canSubmit = !busy && (kind !== "void" || !!text.trim());

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      const url = `/api/admin/food/coupon-stock/${row._id}`;
      const body =
        kind === "void"
          ? { action: "void", reason: text.trim() }
          : kind === "note"
            ? { action: "note", note: text.trim() }
            : { action: kind };
      const res =
        kind === "delete"
          ? await fetch(url, { method: "DELETE" })
          : await fetch(url, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
      const data = await safeJson(res);
      if (!res.ok || data.ok === false) {
        console.error(data);
        setError(data.error || cfg.fail);
        return;
      }
      toast.success(cfg.success(row.code));
      onDone();
    } catch (err) {
      console.error(err);
      setError(cfg.fail);
    } finally {
      setBusy(false);
    }
  }

  function pickReason(r) {
    setText(r);
    setError("");
    textRef.current?.focus();
  }

  const Icon = cfg.icon;

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent
        className="max-w-md rounded-2xl bg-white"
        onOpenAutoFocus={(e) => {
          if (!hasText) return;
          e.preventDefault();
          textRef.current?.focus();
        }}
      >
        <DialogTitle className="text-lg">{cfg.title}</DialogTitle>

        <div className="rounded-xl bg-admin-surfaceMuted p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-all font-mono font-semibold text-admin-text">{row.code}</span>
            <StatusBadge row={row} />
          </div>
          <div className="break-words text-xs text-admin-textMuted">
            ล็อต {lotLabel(row.importBatch)} · หมดอายุ {row.expiresYMD || "—"}
          </div>
        </div>

        {kind === "void" && (
          <>
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
              <DialogDescription className="text-sm text-admin-text">
                รหัสที่ยกเลิกแล้วจะไม่ถูกนำไปใช้ และลบถาวรไม่ได้ — นำกลับเข้าคลังได้ภายหลังหากยกเลิกผิด
              </DialogDescription>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {VOID_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => pickReason(r)}
                    disabled={busy}
                    className={[
                      "rounded-full border px-3 py-1 text-xs transition disabled:opacity-50",
                      text === r
                        ? "border-brand-primaryDark bg-brand-primary/15 font-semibold text-admin-text"
                        : "border-admin-border bg-white text-admin-textMuted hover:bg-admin-surfaceMuted hover:text-admin-text",
                    ].join(" ")}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="text-sm font-medium text-admin-text">
                  เหตุผล <span className="text-red-600">*</span>
                </span>
                <textarea
                  ref={textRef}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value.slice(0, MAX_TEXT));
                    setError("");
                  }}
                  rows={2}
                  disabled={busy}
                  placeholder="ระบุเหตุผลที่ยกเลิกรหัสนี้"
                  className="mt-1 w-full resize-y rounded-xl border border-admin-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              </label>
            </div>
          </>
        )}

        {kind === "note" && (
          <label className="block">
            <span className="text-sm font-medium text-admin-text">หมายเหตุ</span>
            <DialogDescription className="text-xs text-admin-textMuted">
              เว้นว่างไว้เพื่อลบหมายเหตุ
            </DialogDescription>
            <textarea
              ref={textRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value.slice(0, MAX_TEXT));
                setError("");
              }}
              rows={3}
              disabled={busy}
              className="mt-1 w-full resize-y rounded-xl border border-admin-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </label>
        )}

        {kind === "delete" && (
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-500" />
            <DialogDescription className="text-sm text-admin-text">
              ลบรหัส <span className="font-mono font-semibold">{row.code}</span> ออกถาวร —
              ใช้เฉพาะกรณีนำเข้าผิด
            </DialogDescription>
          </div>
        )}

        {kind === "unvoid" && (
          <div className="space-y-2">
            <DialogDescription className="text-sm text-admin-text">
              รหัสนี้จะกลับเป็นสถานะ &quot;พร้อมใช้&quot; และนำไปใช้ได้อีกครั้ง
            </DialogDescription>
            <div className="rounded-xl border border-admin-border p-3 text-sm">
              <div className="text-xs text-admin-textMuted">เหตุผลที่ยกเลิก</div>
              <div className="whitespace-pre-line break-words text-admin-text">
                {row.voidReason || "—"}
              </div>
            </div>
          </div>
        )}

        {kind === "confirmReturn" && (
          <DialogDescription className="text-sm text-admin-text">
            ยืนยันว่าได้รับคูปองกระดาษ <span className="font-mono font-semibold">{row.code}</span>{" "}
            คืนแล้ว — รหัสจะกลับเข้าคลัง (ถ้าล็อตถูกยกเลิก รหัสจะถูกยกเลิกแทน)
          </DialogDescription>
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
            disabled={!canSubmit}
            className={[
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50",
              cfg.danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-primaryDark hover:brightness-110",
            ].join(" ")}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" />}
            {cfg.button}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
