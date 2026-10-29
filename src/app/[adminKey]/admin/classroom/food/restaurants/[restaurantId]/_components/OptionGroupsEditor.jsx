"use client";

import { useState } from "react";
import TextInput from "@/components/ui/TextInput";
import { ChevronDown, ChevronUp, Loader2, MoreVertical, Plus, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { groupLimitsError, normalizeLimit } from "@/lib/optionGroupRules";
import Toggle from "./Toggle";
import { DetachPendingCard, LinkedGroupCard } from "./LinkedGroupCard";
import {
  linkedFromMenuGroup,
  linkedFromSet,
  linkedGroupError,
  linkedHasCustomization,
  linkedToMenuOnly,
  linkedToPayload,
} from "./linkedGroupModel";
import { choicePreview, sameGroupName, setChips } from "./option-sets/optionSetUi";

// ใช้แยกแถวบน UI เท่านั้น ไม่ได้ส่งไป server
// (_id จริงของกลุ่ม/ตัวเลือกเดิมจะถูกส่งกลับไปเพื่อให้ server คงไว้)
function uiKey() {
  return `new-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyChoice() {
  return { _uiKey: uiKey(), name: "", priceDelta: 0, isActive: true };
}

function emptyGroup() {
  return {
    _uiKey: uiKey(),
    name: "",
    required: false,
    selectType: "single",
    choices: [emptyChoice()],
  };
}

export function makeEmptyGroup() {
  return emptyGroup();
}

// new group pre-filled with option names, all priced 0 (admin fills prices in)
export function makeGroupFromNames(name, names, selectType = "multi") {
  return {
    ...emptyGroup(),
    name,
    selectType: selectType === "single" ? "single" : "multi",
    choices: names.map((n) => ({ ...emptyChoice(), name: n })),
  };
}

const limitStr = (v) => (v === null || v === undefined ? "" : String(v));

// แปลง optionGroups ที่โหลดมาจาก API ให้พร้อมแก้ไขบน UI
// OS-3: กลุ่มที่มี sourceSetId -> การ์ดผูกชุด (setsById = ชุดของร้าน ใช้แสดงค่า "ตามชุด")
export function toEditorGroups(groups, setsById = new Map()) {
  return (Array.isArray(groups) ? groups : []).map((g) =>
    g?.sourceSetId ? linkedFromMenuGroup(g, setsById.get(String(g.sourceSetId))) : {
    _uiKey: uiKey(),
    _id: g?._id ? String(g._id) : undefined,
    name: g?.name || "",
    required: !!g?.required,
    selectType: g?.selectType === "multi" ? "multi" : "single",
    minSelect: limitStr(g?.minSelect),
    maxSelect: limitStr(g?.maxSelect),
    choices: (Array.isArray(g?.choices) ? g.choices : []).map((c) => ({
      _uiKey: uiKey(),
      _id: c?._id ? String(c._id) : undefined,
      name: c?.name || "",
      priceDelta: Number(c?.priceDelta) || 0,
      isActive: c?.isActive !== false,
    })),
  });
}

// OS-3: min/max ใช้เฉพาะแบบหลายข้อ · ว่าง = ไม่จำกัด (null)
function menuOnlyLimits(g) {
  if (g.selectType !== "multi") return { minSelect: null, maxSelect: null };
  return { minSelect: normalizeLimit(g.minSelect, 0), maxSelect: normalizeLimit(g.maxSelect, 1) };
}

function menuOnlyPayload(g, gi) {
  return {
    ...(g._id ? { _id: g._id } : {}),
    name: String(g.name || "").trim(),
    required: !!g.required,
    selectType: g.selectType === "multi" ? "multi" : "single",
    ...menuOnlyLimits(g),
    sortOrder: gi,
    choices: (g.choices || []).map((c, ci) => ({
      ...(c._id ? { _id: c._id } : {}),
      name: String(c.name || "").trim(),
      priceDelta: Number(c.priceDelta) || 0,
      sortOrder: ci,
      isActive: c.isActive !== false,
    })),
  };
}

// แปลงกลับเป็น payload สำหรับ API (คง _id เดิมไว้, sortOrder จากลำดับบนจอ — ร่วมกันทั้ง 2 แบบ)
export function toPayloadGroups(groups) {
  return (groups || []).map((g, gi) => (g.linked ? linkedToPayload(g, gi) : menuOnlyPayload(g, gi)));
}

/** comparable key of a menu-only group without its position (unsaved-change check for "บันทึกเป็นชุด") */
export function menuOnlyKey(g) {
  return JSON.stringify({ ...menuOnlyPayload(g, 0), sortOrder: 0 });
}

/** first problem in one group, or "" (shared by the card and the wizard's step check) */
export function groupError(g) {
  if (g.linked) return linkedGroupError(g);
  const msg = groupLimitsError({
    name: String(g.name || "").trim(),
    selectType: g.selectType,
    required: !!g.required,
    ...menuOnlyLimits(g),
  });
  return msg || "";
}

function PromoteForm({ group, onPromote }) {
  const [name, setName] = useState(group.name || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(true);
  if (!open) return null;
  async function submit() {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError("");
    const out = await onPromote(group, name.trim());
    setBusy(false);
    if (out?.error) setError(out.error);
    else setOpen(false);
  }
  return (
    <div className="mt-2 rounded-lg bg-admin-surfaceMuted/70 p-2">
      <label className="block text-[11px] text-admin-textMuted">
        ชื่อชุดตัวเลือก
        <div className="mt-1 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="min-w-0 flex-1 rounded-lg border border-admin-border bg-white px-2 py-1 text-xs text-admin-text outline-none focus:border-brand-primary"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-primaryDark px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3 w-3 animate-spin" />}
            บันทึกเป็นชุด
          </button>
        </div>
      </label>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

/**
 * OS-3 props (all optional — without them the editor works as before):
 *   optionSets       = the restaurant's sets (for "+ เพิ่มจากชุดตัวเลือก")
 *   menuId           = saved menu id ("" = new menu: "บันทึกเป็นชุด" stays disabled)
 *   savedKeys        = Map(groupId -> menuOnlyKey) of the saved menu (unsaved-change check)
 *   onPromote(g, name) -> { error? }   ·   onGoToOptionSets()
 * OS-3b: fromNames = [{ label: "Add-on", names, selectType }] of the Add-on / Drink picked on
 *   this menu (empty names = no link) — the old "สร้างกลุ่มจากรายการที่เลือก" box
 */
export default function OptionGroupsEditor({
  value = [],
  onChange,
  optionSets = [],
  menuId = "",
  savedKeys = new Map(),
  onPromote,
  onGoToOptionSets,
  fromNames = [],
}) {
  const groups = Array.isArray(value) ? value : [];
  // set picked whose name clashes with a menu-only group: { set, index }
  const [clash, setClash] = useState(null);
  const [promotingKey, setPromotingKey] = useState("");
  // OS-3b: expand/collapse per card (UI only) — unset = the default for that group
  const [openByKey, setOpenByKey] = useState({});

  function setGroups(next) {
    onChange?.(next);
  }

  // detach-pending groups become menu-only on save, so their set can be added again
  const linkedSetIds = new Set(groups.filter((g) => g.linked && !g.detachFromSet).map((g) => g.sourceSetId));

  function pickSet(set) {
    const index = groups.findIndex((g) => !g.linked && sameGroupName(g.name, set.name));
    if (index >= 0) setClash({ set, index });
    else setGroups([...groups, linkedFromSet(set)]);
  }

  function resolveClash(mode) {
    if (!clash) return;
    const linked = linkedFromSet(clash.set);
    if (mode === "replace") {
      const next = [...groups];
      next[clash.index] = linked;
      setGroups(next);
    } else {
      setGroups([...groups, linked]);
    }
    setClash(null);
  }

  function detach(gi) {
    const g = groups[gi];
    if (!confirm(`แยก “${g.name}” เป็นกลุ่มของเมนูนี้? จากนี้จะไม่อัปเดตตามชุดอีก`)) return;
    const next = [...groups];
    // saved: the server detaches on save (keeps its saved values) · unsaved: convert right here
    next[gi] = g._id ? { ...g, detachFromSet: true } : linkedToMenuOnly(g);
    setGroups(next);
  }

  function updateGroup(gi, patch) {
    const next = [...groups];
    next[gi] = { ...next[gi], ...patch };
    setGroups(next);
  }

  function moveGroup(gi, dir) {
    const target = gi + dir;
    if (target < 0 || target >= groups.length) return;
    const next = [...groups];
    [next[gi], next[target]] = [next[target], next[gi]];
    setGroups(next);
  }

  function updateChoice(gi, ci, patch) {
    const next = [...groups];
    const choices = [...(next[gi].choices || [])];
    choices[ci] = { ...choices[ci], ...patch };
    next[gi] = { ...next[gi], choices };
    setGroups(next);
  }

  function moveChoice(gi, ci, dir) {
    const choices = [...(groups[gi].choices || [])];
    const target = ci + dir;
    if (target < 0 || target >= choices.length) return;
    [choices[ci], choices[target]] = [choices[target], choices[ci]];
    const next = [...groups];
    next[gi] = { ...next[gi], choices };
    setGroups(next);
  }

  // OS-3b: default open state — linked: menu-level change or just added (no _id yet)
  //        menu-only: new (no _id) or has a validation error
  function isOpen(g) {
    if (Object.prototype.hasOwnProperty.call(openByKey, g._uiKey)) return openByKey[g._uiKey];
    if (g.linked) return !g._id || linkedHasCustomization(g);
    return !g._id || !!groupError(g);
  }
  const toggleOpen = (g) => setOpenByKey((p) => ({ ...p, [g._uiKey]: !isOpen(g) }));

  const addGroup = () => setGroups([...groups, emptyGroup()]);
  const addFromNames = (f) => setGroups([...groups, makeGroupFromNames(f.label, f.names, f.selectType)]);
  const nameLinks = fromNames.filter((f) => (f.names || []).length > 0);

  const clashBar = (set) =>
    clash && String(clash.set._id) === String(set._id) ? (
      <ClashBar
        name={groups[clash.index]?.name}
        onReplace={() => resolveClash("replace")}
        onAdd={() => resolveClash("add")}
        onCancel={() => setClash(null)}
      />
    ) : null;

  const manageLink = onGoToOptionSets ? (
    <button
      type="button"
      onClick={onGoToOptionSets}
      className="text-xs font-medium text-brand-primaryDark hover:underline"
    >
      จัดการชุดตัวเลือก
    </button>
  ) : null;

  /* ---------------- State A: no groups yet ---------------- */
  if (groups.length === 0) {
    return (
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-bold text-admin-text">เมนูนี้ยังไม่มีตัวเลือก</h3>
          <p className="mt-0.5 text-xs text-admin-textMuted">
            ตัวเลือกคือสิ่งที่ผู้เรียนเลือกเพิ่มตอนสั่ง เช่น ระดับความหวาน หรือ À la carte / Set
            ถ้าไม่ใส่ ผู้เรียนสั่งได้เลย
          </p>
        </div>

        <section className="rounded-[14px] border border-admin-border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-admin-text">1. ใช้ชุดตัวเลือกของร้าน</h4>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">แนะนำ</span>
            </div>
            {manageLink}
          </div>
          <p className="mt-1 text-xs text-admin-textMuted">
            กด “เพิ่ม” ได้เลย แก้ที่ชุดครั้งเดียว ทุกเมนูที่ใช้ชุดนี้อัปเดตตาม
          </p>
          {optionSets.length === 0 ? (
            <p className="mt-3 text-xs text-admin-textMuted">ร้านนี้ยังไม่มีชุดตัวเลือก</p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {optionSets.map((s) => (
                <div key={String(s._id)} className="rounded-xl border border-admin-border p-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-admin-text" title={s.name}>
                        {s.name}
                      </div>
                      <div className="text-xs text-admin-textMuted">{setChips(s).join(" · ")}</div>
                      <div className="truncate text-xs text-admin-textMuted" title={choicePreview(s, 99)}>
                        {choicePreview(s)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => pickSet(s)}
                      className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg bg-brand-primaryDark px-2.5 py-1.5 text-xs font-semibold text-white hover:brightness-110"
                    >
                      <Plus className="h-3.5 w-3.5" /> เพิ่ม
                    </button>
                  </div>
                  {clashBar(s)}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-wrap items-start justify-between gap-3 rounded-[14px] border border-dashed border-admin-border bg-white p-4">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-admin-text">2. สร้างกลุ่มใหม่เฉพาะเมนูนี้</h4>
            <p className="mt-0.5 text-xs text-admin-textMuted">
              สำหรับตัวเลือกที่มีแค่เมนูนี้ บันทึกเป็นชุดทีหลังได้
            </p>
            {nameLinks.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={() => addFromNames(f)}
                className="mt-1 block text-xs text-brand-primaryDark hover:underline"
              >
                หรือสร้างจาก {f.label} ที่เลือกไว้ ({f.names.length})
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={addGroup}
            className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-brand-primary/60 bg-white px-3 py-1.5 text-xs font-medium text-brand-primaryDark hover:bg-brand-primary/10"
          >
            <Plus className="h-3.5 w-3.5" /> สร้างกลุ่มใหม่
          </button>
        </section>
      </div>
    );
  }

  /* ---------------- State B: the menu has groups ---------------- */
  return (
    <div className="space-y-3">
      <h3 className="text-base font-bold text-admin-text">ตัวเลือกของเมนูนี้</h3>

      <div className="space-y-3">
        {groups.map((g, gi) => {
          const move = {
            canUp: gi > 0,
            canDown: gi < groups.length - 1,
            onMove: (dir) => moveGroup(gi, dir),
          };
          if (g.linked && g.detachFromSet) {
            return (
              <DetachPendingCard
                key={g._uiKey}
                group={g}
                {...move}
                onUndo={() => updateGroup(gi, { detachFromSet: undefined })}
              />
            );
          }
          if (g.linked) {
            return (
              <LinkedGroupCard
                key={g._uiKey}
                group={g}
                {...move}
                open={isOpen(g)}
                onToggle={() => toggleOpen(g)}
                error={groupError(g)}
                onChange={(patch) => updateGroup(gi, patch)}
                onDetach={() => detach(gi)}
                onRemove={() => setGroups(groups.filter((_, i) => i !== gi))}
              />
            );
          }
          const limitsError = groupError(g);
          const unchanged = !!g._id && savedKeys.get(g._id) === menuOnlyKey(g);
          const canPromote = !!menuId && !!onPromote && unchanged;
          const open = isOpen(g);
          const summary = [
            ...setChips({ selectType: g.selectType, required: g.required, maxSelect: menuOnlyLimits(g).maxSelect }),
            (g.choices || []).map((c) => c.name).filter(Boolean).join(", "),
          ]
            .filter(Boolean)
            .join(" · ");
          return (
          <div
            key={g._uiKey || g._id || gi}
            className="rounded-xl border border-dashed border-admin-border bg-white p-3"
          >
            {/* header row: always visible */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={gi === 0}
                  onClick={() => moveGroup(gi, -1)}
                  className="rounded p-0.5 text-admin-textMuted hover:bg-admin-surfaceMuted disabled:opacity-30"
                  aria-label="เลื่อนกลุ่มขึ้น"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={gi === groups.length - 1}
                  onClick={() => moveGroup(gi, 1)}
                  className="rounded p-0.5 text-admin-textMuted hover:bg-admin-surfaceMuted disabled:opacity-30"
                  aria-label="เลื่อนกลุ่มลง"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold text-admin-text">
                    {String(g.name || "").trim() || "กลุ่มใหม่"}
                  </span>
                  <span className="flex-shrink-0 rounded-md bg-admin-surfaceMuted px-1.5 py-0.5 text-[11px] text-admin-textMuted">
                    เฉพาะเมนูนี้
                  </span>
                </div>
                {!open && (
                  <div className="truncate text-xs text-admin-textMuted" title={summary}>
                    {summary}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => toggleOpen(g)}
                aria-expanded={open}
                className="flex-shrink-0 text-xs font-medium text-brand-primaryDark hover:underline"
              >
                {open ? "ย่อ ▴" : "แก้ไข ▾"}
              </button>
              <GroupMenu
                name={g.name}
                onRemove={() => setGroups(groups.filter((_, i) => i !== gi))}
              />
            </div>

            {open && (
              <>
                <div className="mt-3 space-y-2">
                  <TextInput
                    value={g.name}
                    onChange={(e) => updateGroup(gi, { name: e.target.value })}
                    placeholder="ชื่อกลุ่ม เช่น ระดับความเผ็ด"
                  />

                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-admin-text">
                      <Toggle
                        checked={!!g.required}
                        label="บังคับเลือก"
                        onChange={(v) => updateGroup(gi, { required: v })}
                      />
                      บังคับเลือก
                    </label>

                    <div className="flex items-center gap-2 text-xs text-admin-text">
                      <span className="text-admin-textMuted">เลือกได้</span>
                      <select
                        value={g.selectType}
                        onChange={(e) => updateGroup(gi, { selectType: e.target.value })}
                        className="rounded-lg border border-admin-border bg-white px-2 py-1 text-xs outline-none focus:border-brand-primary"
                      >
                        <option value="single">ข้อเดียว</option>
                        <option value="multi">หลายข้อ</option>
                      </select>
                    </div>

                    {/* OS-3: min/max เฉพาะหลายข้อ · ว่าง = ไม่จำกัด */}
                    {g.selectType === "multi" &&
                      [
                        ["minSelect", "ต่ำสุด", 0],
                        ["maxSelect", "สูงสุด", 1],
                      ].map(([k, label, min]) => (
                        <label key={k} className="flex items-center gap-1 text-xs text-admin-textMuted">
                          {label}
                          <input
                            type="number"
                            inputMode="numeric"
                            min={min}
                            step={1}
                            value={g[k] ?? ""}
                            onChange={(e) => updateGroup(gi, { [k]: e.target.value })}
                            placeholder="ไม่จำกัด"
                            className={`w-20 rounded-lg border bg-white px-2 py-1 text-xs text-admin-text outline-none focus:border-brand-primary ${
                              limitsError ? "border-red-400" : "border-admin-border"
                            }`}
                          />
                        </label>
                      ))}

                    <button
                      type="button"
                      disabled={!canPromote}
                      onClick={() => setPromotingKey(promotingKey === g._uiKey ? "" : g._uiKey)}
                      title={canPromote ? "สร้างชุดตัวเลือกจากกลุ่มนี้" : "บันทึกเมนูก่อน"}
                      className="rounded-lg border border-brand-primary/60 bg-white px-2 py-1 text-[11px] text-brand-primaryDark hover:bg-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      บันทึกเป็นชุด
                    </button>
                    {!canPromote && <span className="text-[11px] text-admin-textMuted">บันทึกเมนูก่อน</span>}
                  </div>
                  {limitsError && <p className="text-xs text-red-600">{limitsError}</p>}
                  {canPromote && promotingKey === g._uiKey && <PromoteForm group={g} onPromote={onPromote} />}
                </div>

                {/* choices */}
                <div className="mt-3 space-y-2 border-t border-admin-border/60 pt-3">
                  {(g.choices || []).map((c, ci) => (
                    <div key={c._uiKey || c._id || ci} className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          disabled={ci === 0}
                          onClick={() => moveChoice(gi, ci, -1)}
                          className="rounded p-0.5 text-admin-textMuted hover:bg-admin-surfaceMuted disabled:opacity-30"
                          aria-label="เลื่อนขึ้น"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={ci === (g.choices || []).length - 1}
                          onClick={() => moveChoice(gi, ci, 1)}
                          className="rounded p-0.5 text-admin-textMuted hover:bg-admin-surfaceMuted disabled:opacity-30"
                          aria-label="เลื่อนลง"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="min-w-0 flex-1">
                        <TextInput
                          value={c.name}
                          onChange={(e) => updateChoice(gi, ci, { name: e.target.value })}
                          placeholder="ชื่อตัวเลือก เช่น เผ็ดน้อย"
                        />
                      </div>

                      <div className="w-28 flex-shrink-0">
                        <TextInput
                          type="number"
                          min="0"
                          step="1"
                          value={c.priceDelta}
                          onChange={(e) => updateChoice(gi, ci, { priceDelta: e.target.value })}
                          placeholder="ราคาเพิ่ม"
                        />
                      </div>

                      <Toggle
                        checked={c.isActive !== false}
                        label={`เปิดใช้งาน ${c.name || "ตัวเลือก"}`}
                        onChange={(v) => updateChoice(gi, ci, { isActive: v })}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          updateGroup(gi, { choices: (g.choices || []).filter((_, i) => i !== ci) })
                        }
                        className="rounded-full bg-red-50 p-1.5 text-red-500 hover:bg-red-100"
                        aria-label={`ลบตัวเลือก ${c.name || ""}`.trim()}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => updateGroup(gi, { choices: [...(g.choices || []), emptyChoice()] })}
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-admin-border px-2 py-1 text-[11px] text-admin-textMuted hover:bg-admin-surfaceMuted"
                  >
                    <Plus className="h-3 w-3" /> เพิ่มตัวเลือก
                  </button>
                </div>
              </>
            )}
          </div>
          );
        })}
      </div>

      {/* เพิ่มตัวเลือก */}
      <section className="space-y-2 rounded-[14px] bg-admin-surfaceMuted/60 px-4 py-3.5">
        <h4 className="text-sm font-semibold text-admin-text">เพิ่มตัวเลือก</h4>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-admin-textMuted">ชุดของร้าน:</span>
          {optionSets.length === 0
            ? manageLink || <span className="text-xs text-admin-textMuted">ยังไม่มีชุดตัวเลือก</span>
            : optionSets.map((s) =>
                linkedSetIds.has(String(s._id)) ? (
                  <span
                    key={String(s._id)}
                    className="rounded-full bg-admin-surfaceMuted px-2.5 py-1 text-xs text-admin-textMuted"
                  >
                    ✓ {s.name}
                  </span>
                ) : (
                  <button
                    key={String(s._id)}
                    type="button"
                    onClick={() => pickSet(s)}
                    className="rounded-full border border-brand-primary/60 bg-white px-2.5 py-1 text-xs font-medium text-brand-primaryDark hover:bg-brand-primary/10"
                  >
                    + {s.name}
                  </button>
                ),
              )}
        </div>
        {/* clash bar right under the pills (the clicked pill is in this row) */}
        {clash && clashBar(clash.set)}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-admin-textMuted">หรือ:</span>
          <button
            type="button"
            onClick={addGroup}
            className="inline-flex items-center gap-1 rounded-lg border border-admin-border bg-white px-2.5 py-1 text-xs font-medium text-admin-text hover:bg-admin-surfaceMuted"
          >
            <Plus className="h-3 w-3" /> สร้างกลุ่มใหม่เฉพาะเมนูนี้
          </button>
          {nameLinks.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => addFromNames(f)}
              className="text-xs text-brand-primaryDark hover:underline"
            >
              จาก {f.label} ที่เลือกไว้ ({f.names.length})
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ClashBar({ name, onReplace, onAdd, onCancel }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
      <span className="min-w-0 flex-1">มีกลุ่ม “{name}” ของเมนูนี้อยู่แล้ว</span>
      <button
        type="button"
        autoFocus
        onClick={onReplace}
        className="rounded-lg bg-brand-primaryDark px-2.5 py-1 font-semibold text-white"
      >
        แทนที่กลุ่มเดิม
      </button>
      <button type="button" onClick={onAdd} className="rounded-lg border border-admin-border bg-white px-2.5 py-1">
        เพิ่มเป็นอีกกลุ่ม
      </button>
      <button type="button" onClick={onCancel} className="px-1 text-admin-textMuted hover:underline">
        ยกเลิก
      </button>
    </div>
  );
}

/** ⋮ on a menu-only card — the delete that was the red ✕ */
function GroupMenu({ name, onRemove }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`จัดการกลุ่ม ${name || ""}`.trim()}
          className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-admin-textMuted hover:bg-admin-surfaceMuted"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-36 rounded-xl bg-white py-1 text-xs shadow-lg ring-1 ring-black/5"
      >
        <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={onRemove}>
          ลบกลุ่มนี้
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
