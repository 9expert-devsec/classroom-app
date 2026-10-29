"use client";

import { useState } from "react";
import TextInput from "@/components/ui/TextInput";
import { ChevronDown, ChevronUp, Loader2, Plus, X } from "lucide-react";
import { groupLimitsError, normalizeLimit } from "@/lib/optionGroupRules";
import Toggle from "./Toggle";
import { AddFromSetButton, DetachPendingCard, LinkedGroupCard } from "./LinkedGroupCard";
import {
  linkedFromMenuGroup,
  linkedFromSet,
  linkedGroupError,
  linkedToMenuOnly,
  linkedToPayload,
} from "./linkedGroupModel";
import { sameGroupName } from "./option-sets/optionSetUi";

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
 */
export default function OptionGroupsEditor({
  value = [],
  onChange,
  optionSets = [],
  menuId = "",
  savedKeys = new Map(),
  onPromote,
  onGoToOptionSets,
}) {
  const groups = Array.isArray(value) ? value : [];
  // set picked whose name clashes with a menu-only group: { set, index }
  const [clash, setClash] = useState(null);
  const [promotingKey, setPromotingKey] = useState("");

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

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm text-admin-text">
          ตัวเลือกเพิ่มเติม (Option)
          <span className="ml-2 text-[11px] text-admin-textMuted">
            {groups.length} กลุ่ม
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <AddFromSetButton
            optionSets={optionSets}
            linkedSetIds={linkedSetIds}
            onPick={pickSet}
            onGoToOptionSets={onGoToOptionSets}
          />
          <button
            type="button"
            onClick={() => setGroups([...groups, emptyGroup()])}
            className="inline-flex items-center gap-1 rounded-lg border border-admin-border bg-white px-2 py-1 text-[11px] font-medium text-admin-text hover:bg-admin-surfaceMuted"
          >
            <Plus className="h-3 w-3" /> เพิ่มกลุ่มตัวเลือก
          </button>
        </div>
      </div>

      {clash && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          <span className="min-w-0 flex-1">
            มีกลุ่ม “{groups[clash.index]?.name}” ของเมนูนี้อยู่แล้ว
          </span>
          <button
            type="button"
            autoFocus
            onClick={() => resolveClash("replace")}
            className="rounded-lg bg-brand-primaryDark px-2.5 py-1 font-semibold text-white"
          >
            แทนที่กลุ่มเดิม
          </button>
          <button
            type="button"
            onClick={() => resolveClash("add")}
            className="rounded-lg border border-admin-border bg-white px-2.5 py-1"
          >
            เพิ่มเป็นอีกกลุ่ม
          </button>
          <button type="button" onClick={() => setClash(null)} className="px-1 text-admin-textMuted hover:underline">
            ยกเลิก
          </button>
        </div>
      )}

      <p className="mb-2 text-[11px] text-admin-textMuted">
        ใช้กับร้านคูปองที่ให้ผู้เรียนสั่งอาหารเอง เช่น ระดับความเผ็ด
        หรือท็อปปิ้งเพิ่ม (ราคาเพิ่มจะถูกบวกเข้ากับราคาเมนู)
      </p>

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
          return (
          <div
            key={g._uiKey || g._id || gi}
            className="rounded-xl border border-dashed border-admin-border bg-white p-3"
          >
            <div className="flex items-start gap-2">
              <div className="flex flex-col pt-1">
                <button
                  type="button"
                  disabled={gi === 0}
                  onClick={() => moveGroup(gi, -1)}
                  className="rounded p-0.5 text-admin-textMuted hover:bg-admin-surfaceMuted disabled:opacity-30"
                  title="เลื่อนกลุ่มขึ้น"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={gi === groups.length - 1}
                  onClick={() => moveGroup(gi, 1)}
                  className="rounded p-0.5 text-admin-textMuted hover:bg-admin-surfaceMuted disabled:opacity-30"
                  title="เลื่อนกลุ่มลง"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <span className="inline-block rounded-md bg-admin-surfaceMuted px-1.5 py-0.5 text-[11px] text-admin-textMuted">
                  เฉพาะเมนูนี้
                </span>
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
                      onChange={(e) =>
                        updateGroup(gi, { selectType: e.target.value })
                      }
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

              <button
                type="button"
                onClick={() => setGroups(groups.filter((_, i) => i !== gi))}
                className="rounded-full bg-red-50 p-1.5 text-red-500 hover:bg-red-100"
                title="ลบกลุ่มนี้"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* choices */}
            <div className="mt-3 space-y-2 border-t border-admin-border/60 pt-3">
              {(g.choices || []).map((c, ci) => (
                <div
                  key={c._uiKey || c._id || ci}
                  className="flex items-center gap-2"
                >
                  <div className="flex flex-col">
                    <button
                      type="button"
                      disabled={ci === 0}
                      onClick={() => moveChoice(gi, ci, -1)}
                      className="rounded p-0.5 text-admin-textMuted hover:bg-admin-surfaceMuted disabled:opacity-30"
                      title="เลื่อนขึ้น"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={ci === (g.choices || []).length - 1}
                      onClick={() => moveChoice(gi, ci, 1)}
                      className="rounded p-0.5 text-admin-textMuted hover:bg-admin-surfaceMuted disabled:opacity-30"
                      title="เลื่อนลง"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <TextInput
                      value={c.name}
                      onChange={(e) =>
                        updateChoice(gi, ci, { name: e.target.value })
                      }
                      placeholder="ชื่อตัวเลือก เช่น เผ็ดน้อย"
                    />
                  </div>

                  <div className="w-28 flex-shrink-0">
                    <TextInput
                      type="number"
                      min="0"
                      step="1"
                      value={c.priceDelta}
                      onChange={(e) =>
                        updateChoice(gi, ci, { priceDelta: e.target.value })
                      }
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
                      updateGroup(gi, {
                        choices: (g.choices || []).filter((_, i) => i !== ci),
                      })
                    }
                    className="rounded-full bg-red-50 p-1.5 text-red-500 hover:bg-red-100"
                    title="ลบตัวเลือกนี้"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  updateGroup(gi, {
                    choices: [...(g.choices || []), emptyChoice()],
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-admin-border px-2 py-1 text-[11px] text-admin-textMuted hover:bg-admin-surfaceMuted"
              >
                <Plus className="h-3 w-3" /> เพิ่มตัวเลือก
              </button>
            </div>
          </div>
          );
        })}

        {groups.length === 0 && (
          <p className="text-[11px] text-admin-textMuted">
            ยังไม่มีกลุ่มตัวเลือก (เมนูนี้จะสั่งได้เลยโดยไม่ต้องเลือกอะไรเพิ่ม)
          </p>
        )}
      </div>
    </div>
  );
}
