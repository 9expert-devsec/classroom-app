"use client";

import { useState } from "react";
import Image from "next/image";
import { Info, Search, Sparkles, X } from "lucide-react";
import OptionGroupsEditor, { makeGroupFromNames } from "../OptionGroupsEditor";

function Thumb({ item, size = 32 }) {
  return (
    <div
      className="relative flex-shrink-0 overflow-hidden rounded-lg bg-admin-surfaceMuted"
      style={{ width: size, height: size }}
    >
      {item.imageUrl && (
        <Image src={item.imageUrl} alt={item.name || ""} fill sizes={`${size}px`} className="object-cover" />
      )}
    </div>
  );
}

/** left: searchable checklist of the shop's list · right: selected items */
function LinkPicker({ label, items, value, onChange }) {
  const [q, setQ] = useState("");
  const kw = q.trim().toLowerCase();
  const shown = kw ? items.filter((x) => String(x.name || "").toLowerCase().includes(kw)) : items;
  const byId = new Map(items.map((x) => [String(x._id), x]));
  const selected = value.map((id) => byId.get(id)).filter(Boolean);

  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="flex min-h-0 flex-col rounded-xl border border-admin-border">
        <div className="relative border-b border-admin-border p-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-textMuted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`ค้นหา ${label}...`}
            className="w-full rounded-lg bg-admin-surfaceMuted py-1.5 pl-8 pr-2 text-sm outline-none"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {shown.map((x) => {
            const id = String(x._id);
            return (
              <label
                key={id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-admin-surfaceMuted/70"
              >
                <input
                  type="checkbox"
                  checked={value.includes(id)}
                  onChange={() => toggle(id)}
                  className="h-4 w-4 accent-[#0099CC]"
                />
                <Thumb item={x} />
                <span className="min-w-0 truncate text-sm">{x.name}</span>
              </label>
            );
          })}
          {shown.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-admin-textMuted">
              {items.length === 0 ? `ร้านนี้ยังไม่มี ${label} ที่เปิดใช้งาน` : "ไม่พบรายการ"}
            </p>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-col rounded-xl border border-admin-border">
        <div className="border-b border-admin-border px-3 py-2 text-sm font-semibold">
          รายการที่เลือก ({selected.length})
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {selected.map((x) => (
            <div key={String(x._id)} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
              <Thumb item={x} />
              <span className="min-w-0 flex-1 truncate text-sm">{x.name}</span>
              <button
                type="button"
                onClick={() => toggle(String(x._id))}
                aria-label={`นำ ${x.name} ออก`}
                className="rounded-full p-1 text-admin-textMuted hover:bg-admin-surfaceMuted hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {selected.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-admin-textMuted">ยังไม่ได้เลือก</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StepOptions({ form, set, addons, drinks, error }) {
  const [tab, setTab] = useState("addons");

  const nameOf = (items, ids) => {
    const byId = new Map(items.map((x) => [String(x._id), x.name]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  };
  const addonNames = nameOf(addons, form.addonIds);
  const drinkNames = nameOf(drinks, form.drinkIds);

  const tabs = [
    ["addons", `Add-on (${addonNames.length})`],
    ["drinks", `Drink (${drinkNames.length})`],
    ["options", `ตัวเลือก (${form.optionGroups.length} กลุ่ม)`],
  ];

  function addGroup(name, names, selectType) {
    set({ optionGroups: [...form.optionGroups, makeGroupFromNames(name, names, selectType)] });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-admin-textMuted">เลือก Add-on หรือ Drink ที่เกี่ยวข้องกับเมนูนี้</p>

      <div role="tablist" className="grid grid-cols-3 rounded-xl bg-admin-surfaceMuted p-1 text-sm">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`truncate rounded-lg px-2 py-2 transition ${
              tab === k
                ? "bg-white font-semibold text-brand-primaryDark shadow-sm"
                : "text-admin-textMuted hover:text-admin-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "addons" && (
        <LinkPicker
          label="Add-on"
          items={addons}
          value={form.addonIds}
          onChange={(addonIds) => set({ addonIds })}
        />
      )}
      {tab === "drinks" && (
        <LinkPicker
          label="Drink"
          items={drinks}
          value={form.drinkIds}
          onChange={(drinkIds) => set({ drinkIds })}
        />
      )}
      {tab === "options" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-admin-border p-3 text-sm">
            <Sparkles className="h-4 w-4 text-brand-primaryDark" />
            <span className="text-admin-text">สร้างกลุ่มจากรายการที่เลือก</span>
            <button
              type="button"
              disabled={addonNames.length === 0}
              onClick={() => addGroup("Add-on", addonNames, "multi")}
              className="rounded-lg border border-brand-primary/60 bg-white px-2.5 py-1 text-xs text-brand-primaryDark hover:bg-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              จาก Add-on ({addonNames.length})
            </button>
            <button
              type="button"
              disabled={drinkNames.length === 0}
              onClick={() => addGroup("Drink", drinkNames, "single")}
              className="rounded-lg border border-brand-primary/60 bg-white px-2.5 py-1 text-xs text-brand-primaryDark hover:bg-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              จาก Drink ({drinkNames.length})
            </button>
            <span className="w-full text-xs text-admin-textMuted">
              สร้างกลุ่มใหม่ที่มีตัวเลือกเป็นรายการที่เลือกไว้ ราคาเริ่มต้น 0 บาท — แก้ราคาได้ในกลุ่มด้านล่าง
            </span>
          </div>
          <OptionGroupsEditor
            value={form.optionGroups}
            onChange={(optionGroups) => set({ optionGroups })}
          />
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-900">
        <Info className="h-4 w-4 flex-shrink-0" />
        ราคาที่ผู้เรียนเห็นมาจาก &quot;ตัวเลือก&quot; เท่านั้น
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
