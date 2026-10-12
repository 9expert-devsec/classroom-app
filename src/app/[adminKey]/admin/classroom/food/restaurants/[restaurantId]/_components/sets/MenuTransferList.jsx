"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GripVertical,
  Search,
  X,
} from "lucide-react";
import { MenuImage } from "../MenuBits";
import { formatPrice, hasPrice, menuCategoryIds, sortCategories } from "../menuUi";

function move(list, from, to) {
  if (from === to || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

function OffTag() {
  return (
    <span className="flex-shrink-0 rounded bg-slate-200 px-1.5 text-[10px] text-slate-600">ปิดใช้งาน</span>
  );
}

/**
 * Left: active menus not in the set (search + category).
 * Right: the set's menus in stored order (FoodSet.menuIds is ordered).
 * value = ordered menu ids.
 */
export default function MenuTransferList({ menus, categories, value, onChange }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [leftChecked, setLeftChecked] = useState([]);
  const [rightChecked, setRightChecked] = useState([]);
  const [dragId, setDragId] = useState("");

  const menuById = useMemo(() => new Map(menus.map((m) => [String(m._id), m])), [menus]);
  const ordered = useMemo(() => sortCategories(categories), [categories]);
  const catById = useMemo(() => new Map(ordered.map((c) => [String(c._id), c])), [ordered]);
  const selectedSet = new Set(value);

  const firstCategory = (m) => {
    const mine = new Set(menuCategoryIds(m));
    return ordered.find((c) => mine.has(String(c._id)));
  };

  const kw = q.trim().toLowerCase();
  const left = menus
    .filter((m) => m.isActive !== false && !selectedSet.has(String(m._id)))
    .filter((m) => !cat || menuCategoryIds(m).includes(cat))
    .filter((m) => !kw || String(m.name || "").toLowerCase().includes(kw))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.name).localeCompare(String(b.name), "th"));

  // ids of menus deleted since are not shown (they stay in value untouched)
  const right = value.map((id) => menuById.get(id)).filter(Boolean);

  const toggle = (list, setList, id) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  function add(ids) {
    const fresh = ids.filter((id) => !selectedSet.has(id));
    if (fresh.length) onChange([...value, ...fresh]);
    setLeftChecked((c) => c.filter((id) => !ids.includes(id)));
  }
  function remove(ids) {
    onChange(value.filter((id) => !ids.includes(id)));
    setRightChecked((c) => c.filter((id) => !ids.includes(id)));
  }

  const leftIds = new Set(left.map((m) => String(m._id)));
  const canAdd = leftChecked.some((id) => leftIds.has(id));
  const canRemove = rightChecked.some((id) => selectedSet.has(id));

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      {/* left */}
      <div className="flex min-h-0 flex-col rounded-xl border border-admin-border">
        <div className="flex flex-wrap gap-2 border-b border-admin-border p-2">
          <div className="relative min-w-[140px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-textMuted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาเมนูอาหาร..."
              className="w-full rounded-lg bg-admin-surfaceMuted py-1.5 pl-8 pr-2 text-sm outline-none"
            />
          </div>
          {ordered.length > 0 && (
            <label className="flex items-center gap-1 rounded-lg border border-admin-border pl-2 text-xs text-admin-textMuted">
              หมวดหมู่
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                className="max-w-[9rem] bg-transparent py-1.5 pr-1 text-sm text-admin-text outline-none"
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
        <div className="max-h-72 min-h-[8rem] overflow-y-auto p-1">
          {left.map((m) => {
            const id = String(m._id);
            const c = firstCategory(m);
            return (
              <label
                key={id}
                onDoubleClick={() => add([id])}
                className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-admin-surfaceMuted/70"
              >
                <input
                  type="checkbox"
                  checked={leftChecked.includes(id)}
                  onChange={() => toggle(leftChecked, setLeftChecked, id)}
                  className="h-4 w-4 flex-shrink-0 accent-[#0099CC]"
                />
                <MenuImage menu={m} sizes="32px" className="h-8 w-8 flex-shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm" title={m.name}>
                  {m.name}
                </span>
                {hasPrice(m.price) && (
                  <span className="flex-shrink-0 text-xs text-admin-textMuted">{formatPrice(m.price)}</span>
                )}
                {c && (
                  <span className="hidden max-w-[6rem] flex-shrink-0 truncate rounded bg-brand-primary/15 px-1.5 text-[10px] text-brand-primaryDark sm:inline">
                    {catById.get(String(c._id))?.name}
                  </span>
                )}
              </label>
            );
          })}
          {left.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-admin-textMuted">
              {menus.some((m) => m.isActive !== false && !selectedSet.has(String(m._id)))
                ? "ไม่พบเมนู"
                : "เลือกเมนูที่เปิดใช้งานครบทุกรายการแล้ว"}
            </p>
          )}
        </div>
      </div>

      {/* arrows (desktop) / text buttons (mobile) */}
      <div className="flex items-center justify-center gap-2 md:flex-col">
        <button
          type="button"
          onClick={() => add(leftChecked.filter((id) => leftIds.has(id)))}
          disabled={!canAdd}
          aria-label="เพิ่มเมนูที่เลือก"
          className="rounded-lg border border-brand-primary/60 bg-white px-3 py-1.5 text-sm text-brand-primaryDark hover:bg-brand-primary/10 disabled:opacity-40 md:px-2"
        >
          <ChevronRight className="hidden h-4 w-4 md:block" />
          <span className="md:hidden">เพิ่มที่เลือก</span>
        </button>
        <button
          type="button"
          onClick={() => remove(rightChecked)}
          disabled={!canRemove}
          aria-label="นำเมนูที่เลือกออก"
          className="rounded-lg border border-admin-border bg-white px-3 py-1.5 text-sm text-admin-text hover:bg-admin-surfaceMuted disabled:opacity-40 md:px-2"
        >
          <ChevronLeft className="hidden h-4 w-4 md:block" />
          <span className="md:hidden">นำออก</span>
        </button>
      </div>

      {/* right */}
      <div className="flex min-h-0 flex-col rounded-xl border border-admin-border">
        <div className="flex items-center justify-between gap-2 border-b border-admin-border px-3 py-2">
          <span className="text-sm font-semibold">เมนูที่เลือกแล้ว ({right.length} รายการ)</span>
          {right.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onChange([]);
                setRightChecked([]);
              }}
              className="text-xs text-brand-primaryDark hover:underline"
            >
              ล้างทั้งหมด
            </button>
          )}
        </div>
        <div className="max-h-72 min-h-[8rem] overflow-y-auto p-1">
          {right.map((m, i) => {
            const id = String(m._id);
            const off = m.isActive === false;
            return (
              <div
                key={id}
                draggable
                onDragStart={(e) => {
                  setDragId(id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (!dragId || dragId === id) return;
                  e.preventDefault();
                  const from = value.indexOf(dragId);
                  const to = value.indexOf(id);
                  if (from >= 0 && to >= 0) onChange(move(value, from, to));
                }}
                onDrop={(e) => e.preventDefault()}
                onDragEnd={() => setDragId("")}
                onDoubleClick={() => remove([id])}
                className={`flex select-none items-center gap-2 rounded-lg px-1.5 py-1.5 ${
                  dragId === id ? "bg-brand-primary/10" : "hover:bg-admin-surfaceMuted/70"
                } ${off ? "text-admin-textMuted" : ""}`}
              >
                <GripVertical className="h-4 w-4 flex-shrink-0 cursor-grab text-admin-textMuted" aria-hidden />
                <input
                  type="checkbox"
                  checked={rightChecked.includes(id)}
                  onChange={() => toggle(rightChecked, setRightChecked, id)}
                  aria-label={`เลือก ${m.name}`}
                  className="h-4 w-4 flex-shrink-0 accent-[#0099CC]"
                />
                <span className="w-5 flex-shrink-0 text-center text-xs text-admin-textMuted">{i + 1}</span>
                <MenuImage menu={m} sizes="32px" className={`h-8 w-8 flex-shrink-0 ${off ? "opacity-50 grayscale" : ""}`} />
                <span className="min-w-0 flex-1 truncate text-sm" title={m.name}>
                  {m.name}
                </span>
                {off && <OffTag />}
                {hasPrice(m.price) && (
                  <span className="flex-shrink-0 text-xs text-admin-textMuted">{formatPrice(m.price)}</span>
                )}
                <div className="flex flex-shrink-0 flex-col">
                  <button
                    type="button"
                    onClick={() => onChange(move(value, value.indexOf(id), value.indexOf(id) - 1))}
                    disabled={i === 0}
                    aria-label="เลื่อนขึ้น"
                    className="rounded hover:bg-admin-surfaceMuted disabled:opacity-30"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(move(value, value.indexOf(id), value.indexOf(id) + 1))}
                    disabled={i === right.length - 1}
                    aria-label="เลื่อนลง"
                    className="rounded hover:bg-admin-surfaceMuted disabled:opacity-30"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => remove([id])}
                  aria-label={`นำ ${m.name} ออก`}
                  className="flex-shrink-0 rounded-full p-1 text-admin-textMuted hover:bg-admin-surfaceMuted hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          {right.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-admin-textMuted">ยังไม่ได้เลือกเมนู</p>
          )}
        </div>
      </div>
    </div>
  );
}
