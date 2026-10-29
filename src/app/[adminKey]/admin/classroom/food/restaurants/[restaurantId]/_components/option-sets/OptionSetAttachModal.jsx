"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { MenuImage } from "../MenuBits";
import { formatPrice, hasPrice, menuCategoryIds, safeJson, sortCategories } from "../menuUi";
import { idStr, sameGroupName } from "./optionSetUi";

/**
 * "ใช้กับเมนู…" — tick menus to attach the set to.
 * A menu that already has its own group with the set's name is never ticked by
 * "select all"; ticking it asks: replace that group (default) or add another one.
 * Mounted only while open. onAttached() after a successful save.
 */
export default function OptionSetAttachModal({ set, menus, categories, open = true, onClose, onAttached }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [checked, setChecked] = useState(() => new Set());
  // menuId -> "replace" | "add" (clash rows only)
  const [clashMode, setClashMode] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);

  const setId = idStr(set._id);
  const ordered = useMemo(() => sortCategories(categories), [categories]);

  const rows = useMemo(
    () =>
      [...menus]
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.name).localeCompare(String(b.name), "th"))
        .map((m) => {
          const groups = m.optionGroups || [];
          const linked = groups.some((g) => idStr(g.sourceSetId) === setId);
          const clash = linked
            ? null
            : groups.find((g) => !g.sourceSetId && sameGroupName(g.name, set.name)) || null;
          return { menu: m, id: String(m._id), linked, clash };
        }),
    [menus, setId, set.name],
  );

  const kw = q.trim().toLowerCase();
  const shown = rows
    .filter((r) => !cat || menuCategoryIds(r.menu).includes(cat))
    .filter((r) => !kw || String(r.menu.name || "").toLowerCase().includes(kw));

  // select-all covers shown rows that are not linked and have no name clash
  const selectable = shown.filter((r) => !r.linked && !r.clash);
  const allSelected = selectable.length > 0 && selectable.every((r) => checked.has(r.id));

  function toggle(id) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const r of selectable) {
        if (allSelected) next.delete(r.id);
        else next.add(r.id);
      }
      return next;
    });
  }

  const n = checked.size;

  async function submit() {
    if (!n || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const byId = new Map(rows.map((r) => [r.id, r]));
      const menuIds = [...checked];
      const replace = menuIds
        .map((id) => byId.get(id))
        .filter((r) => r?.clash && (clashMode[r.id] || "replace") === "replace")
        .map((r) => ({ menuId: r.id, groupId: idStr(r.clash._id) }));
      const res = await fetch(`/api/admin/food/option-sets/${setId}/attach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuIds, replace }),
      });
      const out = await safeJson(res);
      if (!res.ok) {
        setError(out.error || "ผูกชุดตัวเลือกไม่สำเร็จ");
        return;
      }
      toast.success(`ผูก “${set.name}” กับ ${out.attached?.length ?? n} เมนูเรียบร้อย`);
      onAttached?.();
    } catch (err) {
      console.error(err);
      setError("ผูกชุดตัวเลือกไม่สำเร็จ");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="flex max-h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] max-w-[640px] flex-col gap-0 rounded-2xl bg-white p-0">
        <div className="border-b border-admin-border px-5 py-4 pr-12">
          <DialogTitle className="text-lg">ใช้ “{set.name}” กับเมนู</DialogTitle>
          <DialogDescription className="mt-1 text-xs text-admin-textMuted">
            เมนูที่เลือกได้กลุ่มนี้ตามค่าเริ่มต้นของชุด ปรับราคา/ซ่อนตัวเลือกรายเมนูได้ภายหลัง
          </DialogDescription>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[160px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-textMuted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหาเมนูอาหาร..."
                aria-label="ค้นหาเมนูอาหาร"
                className="w-full rounded-lg border border-admin-border bg-white py-1.5 pl-8 pr-2 text-sm outline-none focus:border-brand-primary"
              />
            </div>
            {ordered.length > 0 && (
              <label className="flex items-center gap-1 rounded-lg border border-admin-border pl-2 text-xs text-admin-textMuted">
                หมวดหมู่
                <select
                  value={cat}
                  onChange={(e) => setCat(e.target.value)}
                  className="max-w-[10rem] bg-transparent py-1.5 pr-1 text-sm text-admin-text outline-none"
                >
                  <option value="">ทั้งหมด</option>
                  {ordered.map((c) => (
                    <option key={String(c._id)} value={String(c._id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="min-h-[10rem] flex-1 overflow-y-auto rounded-xl border border-admin-border">
            <label className="flex cursor-pointer items-center gap-2 border-b border-admin-border bg-admin-surfaceMuted/60 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={selectable.length === 0}
                onChange={toggleAll}
                className="h-4 w-4 accent-[#0099CC]"
              />
              เลือกทั้งหมดที่แสดง (ที่ยังไม่ผูก)
            </label>
            {shown.map((r) => {
              const { menu: m, id } = r;
              const on = r.linked || checked.has(id);
              const mode = clashMode[id] || "replace";
              return (
                <div key={id} className="border-b border-admin-border/60 last:border-b-0">
                  <label
                    className={`flex items-center gap-2 px-3 py-1.5 ${
                      r.linked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-admin-surfaceMuted/70"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={r.linked}
                      onChange={() => toggle(id)}
                      className="h-4 w-4 flex-shrink-0 accent-[#0099CC]"
                    />
                    <MenuImage menu={m} sizes="32px" className="h-8 w-8 flex-shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm" title={m.name}>
                        {m.name}
                      </span>
                      {r.clash && (
                        <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 text-[10px] text-amber-800">
                          มีกลุ่ม “{r.clash.name}” ของเมนูเองอยู่แล้ว
                        </span>
                      )}
                    </span>
                    {r.linked && (
                      <span className="flex-shrink-0 rounded bg-slate-200 px-1.5 text-[10px] text-slate-600">ผูกแล้ว</span>
                    )}
                    {m.isActive === false && !r.linked && (
                      <span className="flex-shrink-0 rounded bg-slate-200 px-1.5 text-[10px] text-slate-600">ปิดใช้งาน</span>
                    )}
                    {hasPrice(m.price) && (
                      <span className="flex-shrink-0 text-xs text-admin-textMuted">{formatPrice(m.price)}</span>
                    )}
                  </label>
                  {r.clash && checked.has(id) && (
                    <div
                      role="radiogroup"
                      aria-label={`กลุ่ม “${r.clash.name}” เดิมของ ${m.name}`}
                      className="flex flex-wrap gap-3 px-3 pb-2 pl-[4.25rem] text-xs"
                    >
                      {[
                        ["replace", "แทนที่กลุ่มเดิม"],
                        ["add", "เพิ่มเป็นอีกกลุ่ม"],
                      ].map(([v, label]) => (
                        <label key={v} className="flex cursor-pointer items-center gap-1.5">
                          <input
                            type="radio"
                            name={`clash-${id}`}
                            value={v}
                            checked={mode === v}
                            onChange={() => setClashMode((p) => ({ ...p, [id]: v }))}
                            className="accent-[#0099CC]"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {shown.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-admin-textMuted">ไม่พบเมนู</p>
            )}
          </div>

          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-admin-border px-5 py-4">
          <span className="text-sm text-admin-textMuted">เลือกแล้ว {n} เมนู</span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-admin-border bg-white px-5 py-2.5 text-sm font-medium hover:bg-admin-surfaceMuted disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving || n === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primaryDark px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              ผูกกับ {n} เมนู
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
