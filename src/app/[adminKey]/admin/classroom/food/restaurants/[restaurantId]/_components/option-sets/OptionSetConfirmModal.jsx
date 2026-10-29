"use client";

import { Info, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { computeChanges, plusPrice } from "./optionSetUi";

function Tag({ kind, children }) {
  const cls = kind === "add" ? "bg-green-100 text-green-800" : "bg-admin-surfaceMuted text-admin-text";
  return (
    <span className={`inline-flex w-14 flex-shrink-0 justify-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

/**
 * Per linked menu: overrides that survive (choice still in the set) and the ones
 * that are lost (choice removed — from the server preview).
 */
function menuRows(impact, usageMenus, after) {
  const usageById = new Map((usageMenus || []).map((m) => [String(m._id), m]));
  const afterById = new Map(after.choices.filter((c) => c._id).map((c) => [c._id, c]));
  const followers = [];
  const special = [];
  for (const m of impact.menus || []) {
    const kept = (usageById.get(m.id)?.overrides || [])
      .filter((o) => afterById.has(o.sourceChoiceId))
      .map((o) => `${afterById.get(o.sourceChoiceId).name} คง ${plusPrice(o.priceDelta) || "+0"} (ปรับเฉพาะเมนู)`);
    const lost = (m.lostOverrides || []).map((l) => {
      const what = l.kinds.includes("priceDelta") && l.kinds.includes("hidden")
        ? "ราคาที่ปรับเองและการซ่อน"
        : l.kinds.includes("priceDelta")
          ? "ราคาที่ปรับเอง"
          : "การซ่อน";
      return `${l.choice} ถูกลบจากชุด — ${what}ของเมนูนี้จะหายไป`;
    });
    if (!kept.length && !lost.length) followers.push(m);
    for (const text of kept) special.push({ key: `${m.id}-k-${text}`, name: m.name, text, tone: "amber" });
    for (const text of lost) special.push({ key: `${m.id}-l-${text}`, name: m.name, text, tone: "lost" });
  }
  return { followers, special };
}

/** "บันทึกและอัปเดต N เมนู" — opened from the set form after a successful preview */
export default function OptionSetConfirmModal({ open, before, after, impact, usageMenus, saving, error, onBack, onConfirm }) {
  const changes = computeChanges(before, after);
  const { followers, special } = menuRows(impact, usageMenus, after);
  const n = (impact.menus || []).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onBack()}>
      <DialogContent className="flex max-h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] max-w-[640px] flex-col gap-0 rounded-2xl bg-white p-0">
        <div className="border-b border-admin-border px-5 py-4 pr-12">
          <DialogTitle className="text-lg">ยืนยันการบันทึก “{after.name}”</DialogTitle>
          <DialogDescription className="sr-only">ตรวจสอบสิ่งที่เปลี่ยนและเมนูที่จะอัปเดต</DialogDescription>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section>
            <h3 className="mb-2 text-sm font-semibold">สิ่งที่เปลี่ยน</h3>
            {changes.length ? (
              <ul className="space-y-1.5">
                {changes.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Tag kind={c.kind}>{c.tag}</Tag>
                    <span className="min-w-0 break-words">{c.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-admin-textMuted">ไม่มีการเปลี่ยนแปลงค่าของชุด</p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">จะอัปเดต {n} เมนู</h3>
            <div className="overflow-hidden rounded-xl border border-admin-border">
              <table className="w-full text-sm">
                <thead className="bg-admin-surfaceMuted text-left text-xs text-admin-textMuted">
                  <tr>
                    <th className="px-3 py-2 font-medium">เมนู</th>
                    <th className="px-3 py-2 font-medium">ผลหลังบันทึก</th>
                  </tr>
                </thead>
                <tbody>
                  {followers.length > 0 && (
                    <tr className="border-t border-admin-border/60">
                      <td className="px-3 py-2">
                        {followers[0].name}
                        {followers.length > 1 ? ` และอีก ${followers.length - 1} เมนู` : ""}
                      </td>
                      <td className="px-3 py-2 text-admin-textMuted">ใช้ค่าตามชุด</td>
                    </tr>
                  )}
                  {special.map((r) => (
                    <tr
                      key={r.key}
                      className={`border-t border-admin-border/60 ${r.tone === "amber" ? "bg-amber-50" : ""}`}
                    >
                      <td className="px-3 py-2">{r.name}</td>
                      <td className={`px-3 py-2 ${r.tone === "lost" ? "text-red-700" : "text-amber-800"}`}>{r.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-900">
            <Info className="h-4 w-4 flex-shrink-0" />
            ออเดอร์ที่สั่งไปแล้วไม่เปลี่ยน · ผู้เรียนที่ค้างตัวเลือกเดิมในตะกร้าจะถูกขอให้เลือกใหม่ตอนยืนยัน
          </div>

          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-admin-border px-5 py-4">
          <button
            type="button"
            onClick={onBack}
            disabled={saving}
            className="rounded-xl border border-admin-border bg-white px-5 py-2.5 text-sm font-medium hover:bg-admin-surfaceMuted disabled:opacity-50"
          >
            กลับไปแก้
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primaryDark px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            บันทึกและอัปเดต {n} เมนู
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
