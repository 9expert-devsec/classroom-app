"use client";

import TextInput from "@/components/ui/TextInput";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import Toggle from "./Toggle";

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

// แปลง optionGroups ที่โหลดมาจาก API ให้พร้อมแก้ไขบน UI
export function toEditorGroups(groups) {
  return (Array.isArray(groups) ? groups : []).map((g) => ({
    _uiKey: uiKey(),
    _id: g?._id ? String(g._id) : undefined,
    name: g?.name || "",
    required: !!g?.required,
    selectType: g?.selectType === "multi" ? "multi" : "single",
    choices: (Array.isArray(g?.choices) ? g.choices : []).map((c) => ({
      _uiKey: uiKey(),
      _id: c?._id ? String(c._id) : undefined,
      name: c?.name || "",
      priceDelta: Number(c?.priceDelta) || 0,
      isActive: c?.isActive !== false,
    })),
  }));
}

// แปลงกลับเป็น payload สำหรับ API (คง _id เดิมไว้, sortOrder จากลำดับบนจอ)
export function toPayloadGroups(groups) {
  return (groups || []).map((g, gi) => ({
    ...(g._id ? { _id: g._id } : {}),
    name: String(g.name || "").trim(),
    required: !!g.required,
    selectType: g.selectType === "multi" ? "multi" : "single",
    sortOrder: gi,
    choices: (g.choices || []).map((c, ci) => ({
      ...(c._id ? { _id: c._id } : {}),
      name: String(c.name || "").trim(),
      priceDelta: Number(c.priceDelta) || 0,
      sortOrder: ci,
      isActive: c.isActive !== false,
    })),
  }));
}

export default function OptionGroupsEditor({ value = [], onChange }) {
  const groups = Array.isArray(value) ? value : [];

  function setGroups(next) {
    onChange?.(next);
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
        <button
          type="button"
          onClick={() => setGroups([...groups, emptyGroup()])}
          className="inline-flex items-center gap-1 rounded-lg border border-admin-border bg-white px-2 py-1 text-[11px] font-medium text-admin-text hover:bg-admin-surfaceMuted"
        >
          <Plus className="h-3 w-3" /> เพิ่มกลุ่มตัวเลือก
        </button>
      </div>

      <p className="mb-2 text-[11px] text-admin-textMuted">
        ใช้กับร้านคูปองที่ให้ผู้เรียนสั่งอาหารเอง เช่น ระดับความเผ็ด
        หรือท็อปปิ้งเพิ่ม (ราคาเพิ่มจะถูกบวกเข้ากับราคาเมนู)
      </p>

      <div className="space-y-3">
        {groups.map((g, gi) => (
          <div
            key={g._uiKey || g._id || gi}
            className="rounded-xl border border-admin-border bg-white p-3"
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
                </div>
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
        ))}

        {groups.length === 0 && (
          <p className="text-[11px] text-admin-textMuted">
            ยังไม่มีกลุ่มตัวเลือก (เมนูนี้จะสั่งได้เลยโดยไม่ต้องเลือกอะไรเพิ่ม)
          </p>
        )}
      </div>
    </div>
  );
}
