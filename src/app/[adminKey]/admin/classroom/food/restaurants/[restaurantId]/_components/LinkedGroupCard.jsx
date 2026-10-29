"use client";

// OS-3: การ์ดกลุ่มที่ผูกชุดตัวเลือกในฟอร์มเมนู (OS-3b: แถบหัวย่อ/เปิดได้)
import { useState } from "react";
import { ChevronDown, ChevronUp, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { effectiveOf, priceOverridden } from "./linkedGroupModel";
import { setChips } from "./option-sets/optionSetUi";

const numCls =
  "w-16 rounded-lg border border-admin-border bg-white px-2 py-1 text-xs outline-none focus:border-brand-primary";

const show = (v) => (v === null || v === undefined ? "ไม่จำกัด" : v);

function MoveButtons({ canUp, canDown, onMove }) {
  return (
    <div className="flex flex-col pt-0.5">
      <button
        type="button"
        disabled={!canUp}
        onClick={() => onMove(-1)}
        className="rounded p-0.5 text-admin-textMuted hover:bg-admin-surfaceMuted disabled:opacity-30"
        aria-label="เลื่อนกลุ่มขึ้น"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        disabled={!canDown}
        onClick={() => onMove(1)}
        className="rounded p-0.5 text-admin-textMuted hover:bg-admin-surfaceMuted disabled:opacity-30"
        aria-label="เลื่อนกลุ่มลง"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** price 0 without an override reads "ฟรี" until clicked; then the normal input */
function PriceField({ choice: c, over, onChange }) {
  const [editing, setEditing] = useState(false);
  const free = !over && Number(c.priceDelta) === 0;
  if (free && !editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`ราคาเพิ่มของ ${c.name}: ฟรี (กดเพื่อปรับ)`}
        className="w-20 rounded-lg border border-admin-border bg-white px-2 py-1 text-left text-xs text-admin-textMuted hover:border-brand-primary"
      >
        ฟรี
      </button>
    );
  }
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      value={c.priceDelta}
      autoFocus={editing}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => setEditing(false)}
      aria-label={`ราคาเพิ่มของ ${c.name}`}
      className={`w-20 rounded-lg border px-2 py-1 text-xs outline-none focus:border-brand-primary ${
        over ? "border-amber-400 bg-amber-50" : "border-admin-border bg-white"
      }`}
    />
  );
}

export function LinkedGroupCard({
  group: g,
  onChange,
  onDetach,
  onRemove,
  canUp,
  canDown,
  onMove,
  error,
  open = true,
  onToggle,
}) {
  const multi = g.selectType === "multi";
  const eff = effectiveOf(g);
  const summary = setChips({ selectType: g.selectType, required: eff.required, maxSelect: eff.maxSelect }).join(" · ");
  const patchChoice = (key, p) =>
    onChange({ choices: g.choices.map((c) => (c._uiKey === key ? { ...c, ...p } : c)) });

  return (
    <div className="overflow-hidden rounded-xl border border-admin-border bg-white">
      {/* header band */}
      <div className="flex items-center gap-2 bg-admin-surfaceMuted/50 px-3 py-2">
        <MoveButtons canUp={canUp} canDown={canDown} onMove={onMove} />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-semibold text-admin-text" title={g.name}>
            {g.name}
          </span>
          <span className="flex-shrink-0 rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
            จากชุด
          </span>
          <span className="flex-shrink-0 text-xs text-admin-textMuted">{summary}</span>
        </div>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex-shrink-0 text-xs font-medium text-brand-primaryDark hover:underline"
          >
            {open ? "ย่อ ▴" : "เปิด ▾"}
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`จัดการกลุ่ม ${g.name}`}
              className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-admin-textMuted hover:bg-admin-surfaceMuted"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="w-44 rounded-xl bg-white py-1 text-xs shadow-lg ring-1 ring-black/5"
          >
            <DropdownMenuItem onSelect={onDetach}>แยกเป็นของเมนูนี้</DropdownMenuItem>
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={onRemove}>
              เอาออกจากเมนู
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* collapsed: an error still shows so it is never hidden */}
      {!open && error && <p className="px-3 pb-2 pt-1 text-xs text-red-600">{error}</p>}

      {open && (
        <div className="p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1 text-admin-textMuted">
              บังคับ
              <select
                value={g.required}
                onChange={(e) => onChange({ required: e.target.value })}
                className="rounded-lg border border-admin-border bg-white px-2 py-1 text-xs text-admin-text outline-none focus:border-brand-primary"
              >
                <option value="">ตามชุด ({g.set.required ? "บังคับ" : "ไม่บังคับ"})</option>
                <option value="yes">บังคับ</option>
                <option value="no">ไม่บังคับ</option>
              </select>
            </label>
            {multi &&
              [
                ["minSelect", "ต่ำสุด", 0],
                ["maxSelect", "สูงสุด", 1],
              ].map(([k, label, min]) => (
                <label key={k} className="flex items-center gap-1 text-admin-textMuted">
                  {label}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={min}
                    step={1}
                    value={g[k]}
                    onChange={(e) => onChange({ [k]: e.target.value })}
                    placeholder={`ตามชุด: ${show(g.set[k])}`}
                    aria-label={`${label} (เว้นว่าง = ตามชุด)`}
                    className={`${numCls} w-28`}
                  />
                </label>
              ))}
          </div>

          <div className="mt-3 space-y-1.5 border-t border-admin-border/60 pt-3">
            {g.choices.map((c) => {
              const over = priceOverridden(c);
              return (
                <div key={c._uiKey} className="flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className={`min-w-0 flex-1 truncate ${c.setActive ? "" : "text-admin-textMuted line-through"}`}
                    title={c.name}
                  >
                    {c.name}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-xs text-admin-textMuted">+</span>
                    <PriceField
                      choice={c}
                      over={over}
                      onChange={(v) => patchChoice(c._uiKey, { priceDelta: v })}
                    />
                    {over && c.defaultPrice !== null ? (
                      <button
                        type="button"
                        onClick={() => patchChoice(c._uiKey, { priceDelta: String(c.defaultPrice) })}
                        className="text-[11px] text-amber-700 underline-offset-2 hover:underline"
                      >
                        คืนค่า (+{c.defaultPrice})
                      </button>
                    ) : (
                      <span className="text-[11px] text-admin-textMuted">{over ? "ปรับเฉพาะเมนู" : "ตามชุด"}</span>
                    )}
                  </span>
                  <label className="flex items-center gap-1 text-xs text-admin-text">
                    <input
                      type="checkbox"
                      checked={c.setActive && !c.hidden}
                      disabled={!c.setActive}
                      onChange={(e) => patchChoice(c._uiKey, { hidden: !e.target.checked })}
                      className="h-4 w-4 accent-[#0099CC]"
                    />
                    {c.setActive ? "แสดง" : "ปิดที่ชุด"}
                  </label>
                </div>
              );
            })}
          </div>

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <p className="mt-2 text-[11px] text-admin-textMuted">
            กดที่ราคาเพื่อปรับเฉพาะเมนูนี้ · ชื่อตัวเลือกแก้ที่แท็บชุดตัวเลือก
          </p>
        </div>
      )}
    </div>
  );
}

/** a saved linked group that will become menu-only on save (server keeps its current values) */
export function DetachPendingCard({ group: g, onUndo, canUp, canDown, onMove }) {
  return (
    <div className="rounded-xl border border-dashed border-admin-border bg-white p-3">
      <div className="flex items-start gap-2">
        <MoveButtons canUp={canUp} canDown={canDown} onMove={onMove} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-admin-text">{g.name}</span>
            <span className="rounded-md bg-admin-surfaceMuted px-1.5 py-0.5 text-[11px] text-admin-textMuted">
              เฉพาะเมนูนี้
            </span>
          </div>
          <ul className="mt-2 space-y-0.5 text-xs text-admin-text">
            {g.choices.map((c) => (
              <li key={c._uiKey} className={c.setActive && !c.hidden ? "" : "text-admin-textMuted line-through"}>
                {c.name} {Number(c.priceDelta) > 0 ? `+${Number(c.priceDelta)}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-amber-700">
            จะแยกเป็นของเมนูนี้เมื่อบันทึก (ใช้ค่าที่บันทึกไว้ล่าสุด) — แก้ไขรายละเอียดได้หลังบันทึก
          </p>
        </div>
        <button
          type="button"
          onClick={onUndo}
          className="flex-shrink-0 rounded-lg border border-admin-border px-2 py-1 text-[11px] hover:bg-admin-surfaceMuted"
        >
          ยกเลิกการแยก
        </button>
      </div>
    </div>
  );
}
