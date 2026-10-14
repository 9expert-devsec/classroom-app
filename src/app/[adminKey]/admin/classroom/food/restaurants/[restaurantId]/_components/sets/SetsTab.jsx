"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, LayoutList, Pencil, Plus, Search, Trash2 } from "lucide-react";
import SetCard from "./SetCard";
import { SetAvatar, menusInSet } from "./setUi";

const collator = new Intl.Collator("th");

function Toolbar({ params, setParams, searchResetKey }) {
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-[2_1_320px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-textMuted" />
        <input
          key={searchResetKey}
          defaultValue={params.q}
          onChange={(e) => {
            const v = e.target.value;
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setParams({ q: v.trim() }), 300);
          }}
          placeholder="ค้นหาชุดอาหาร ชื่อชุด หรือเมนูในชุด..."
          className="w-full rounded-xl border border-admin-border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        />
      </div>
      {/* sets have no display order field, so the order is by name */}
      <label className="flex min-w-0 flex-[1_1_200px] items-center gap-2 rounded-xl border border-admin-border bg-white pl-3">
        <span className="flex-shrink-0 text-xs text-admin-textMuted">เรียงตาม</span>
        <select
          value={params.sort === "count" ? "count" : ""}
          onChange={(e) => setParams({ sort: e.target.value })}
          className="min-w-0 flex-1 cursor-pointer rounded-xl bg-transparent py-2 pr-2 text-sm outline-none"
        >
          <option value="">ชื่อ</option>
          <option value="count">จำนวนเมนู</option>
        </select>
      </label>
      <div className="flex flex-shrink-0 overflow-hidden rounded-xl border border-admin-border bg-white">
        {[
          ["grid", LayoutGrid, "มุมมองการ์ด"],
          ["list", LayoutList, "มุมมองตาราง"],
        ].map(([v, Icon, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setParams({ view: v === "grid" ? "" : v, page: params.page })}
            aria-label={label}
            aria-pressed={params.view === v}
            className={`inline-flex h-9 w-10 items-center justify-center ${
              params.view === v ? "bg-brand-primaryDark text-white" : "text-admin-textMuted hover:bg-admin-surfaceMuted"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
}

function SetsTable({ rows, onView, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-admin-border bg-white">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-admin-surfaceMuted text-left text-xs text-admin-textMuted">
          <tr>
            <th className="px-3 py-2 font-medium">ชื่อชุด</th>
            <th className="px-3 py-2 text-center font-medium">จำนวนเมนู</th>
            <th className="px-3 py-2 font-medium">เมนูในชุด</th>
            <th className="px-3 py-2 text-right font-medium">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ set, items }) => (
            <tr
              key={String(set._id)}
              onClick={() => onView(set)}
              className="cursor-pointer border-t border-admin-border/60 hover:bg-admin-surfaceMuted/60"
            >
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <SetAvatar name={set.name} size="sm" />
                  <span className="font-medium">{set.name}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-center">{items.length}</td>
              <td className="max-w-[360px] truncate px-3 py-2 text-xs text-admin-textMuted" title={items.map((m) => m.name).join(", ")}>
                {items.map((m) => m.name).join(", ") || "—"}
              </td>
              <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onEdit(set)}
                  aria-label={`แก้ไข ${set.name}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-brand-primaryDark hover:bg-brand-primary/10"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(set)}
                  aria-label={`ลบ ${set.name}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SetsTab({
  sets,
  menus,
  loading,
  params,
  setParams,
  highlightId,
  onNew,
  onView,
  onEdit,
  onDelete,
}) {
  const [searchResetKey, setSearchResetKey] = useState(0);
  const menuById = useMemo(() => new Map(menus.map((m) => [String(m._id), m])), [menus]);

  const rows = useMemo(() => {
    const kw = params.q.toLowerCase();
    const list = sets
      .map((set) => ({ set, items: menusInSet(set, menuById) }))
      // set name OR any menu name in the set
      .filter(
        ({ set, items }) =>
          !kw ||
          String(set.name || "").toLowerCase().includes(kw) ||
          items.some((m) => String(m.name || "").toLowerCase().includes(kw)),
      );
    const byName = (a, b) => collator.compare(a.set.name || "", b.set.name || "");
    return list.sort(
      params.sort === "count" ? (a, b) => b.items.length - a.items.length || byName(a, b) : byName,
    );
  }, [sets, menuById, params.q, params.sort]);

  const handlers = { onView, onEdit, onDelete };

  return (
    <div className="space-y-4">
      <Toolbar params={params} setParams={setParams} searchResetKey={searchResetKey} />

      {loading && sets.length === 0 ? (
        <p className="py-10 text-center text-sm text-admin-textMuted">กำลังโหลด...</p>
      ) : sets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-admin-border bg-white py-12">
          <div className="text-sm text-admin-textMuted">ยังไม่มีชุดอาหาร</div>
          <button
            type="button"
            onClick={onNew}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primaryDark px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            <Plus className="h-4 w-4" /> เพิ่มชุดอาหาร
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="space-y-2 rounded-2xl border border-dashed border-admin-border bg-white py-12 text-center text-sm text-admin-textMuted">
          <div>ไม่พบชุดอาหารตามคำค้นหา</div>
          <button
            type="button"
            onClick={() => {
              setParams({ q: "" });
              setSearchResetKey((k) => k + 1);
            }}
            className="text-xs text-brand-primaryDark hover:underline"
          >
            ล้างคำค้นหา
          </button>
        </div>
      ) : params.view === "list" ? (
        <SetsTable rows={rows} {...handlers} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map(({ set, items }) => (
            <SetCard
              key={String(set._id)}
              set={set}
              items={items}
              highlight={highlightId === String(set._id)}
              {...handlers}
            />
          ))}
        </div>
      )}
    </div>
  );
}
