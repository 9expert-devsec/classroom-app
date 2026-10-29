"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import Toggle from "../Toggle";
import { safeJson } from "../menuUi";
import OptionSetConfirmModal from "./OptionSetConfirmModal";
import OptionSetAttachModal from "./OptionSetAttachModal";
import OptionSetDeleteDialog from "./OptionSetDeleteDialog";
import {
  OPTION_SET_NAME_MAX,
  emptyChoice,
  idStr,
  overrideChipText,
  toForm,
  toPayload,
  validateForm,
} from "./optionSetUi";

function move(list, from, to) {
  if (from === to || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

const inputCls =
  "w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:cursor-not-allowed disabled:bg-admin-surfaceMuted disabled:text-admin-textMuted";

/**
 * Create / edit one option set. Mounted only while open.
 * set = live row from the list (with usage) or null for create.
 * Edit of a set used by menus: preview first, then the confirm modal.
 */
export default function OptionSetFormModal({ restaurantId, set, menus, categories, onClose, onSaved, onChanged, onDeleted }) {
  const isEdit = !!set;
  const [initial] = useState(() => toForm(set));
  const [form, setForm] = useState(initial);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // null | "confirm" | "attach" | "delete" — this form stays mounted (edits kept) under them
  const [sub, setSub] = useState(null);
  const [impact, setImpact] = useState(null);
  const [dragKey, setDragKey] = useState("");
  const savingRef = useRef(false);

  const errors = validateForm(form);
  const hasErrors = Object.keys(errors).length > 0;
  const payload = useMemo(() => toPayload(form), [form]);
  const dirty = JSON.stringify(payload) !== JSON.stringify(toPayload(initial));
  const linkedMenus = set?.menus || [];
  const multi = form.selectType === "multi";

  const patch = (p) => setForm((f) => ({ ...f, ...p }));
  const patchChoice = (key, p) =>
    setForm((f) => ({ ...f, choices: f.choices.map((c) => (c._key === key ? { ...c, ...p } : c)) }));
  const moveChoice = (from, to) => setForm((f) => ({ ...f, choices: move(f.choices, from, to) }));

  function requestClose() {
    if (saving) return;
    if (dirty && !confirm("ปิดหน้าต่างนี้? การเปลี่ยนแปลงที่ยังไม่ได้บันทึกจะหายไป")) return;
    onClose();
  }

  async function write(method, url) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { res, out: await safeJson(res) };
  }

  async function save(e) {
    e?.preventDefault();
    setTouched(true);
    if (hasErrors || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      if (!isEdit || !(set.menuCount > 0)) {
        const { res, out } = isEdit
          ? await write("PUT", `/api/admin/food/option-sets/${idStr(set._id)}`)
          : await write("POST", `/api/admin/food/option-sets?restaurant=${encodeURIComponent(restaurantId)}`);
        if (!res.ok) {
          setError(out.error || "บันทึกชุดตัวเลือกไม่สำเร็จ");
          return;
        }
        toast.success(isEdit ? "บันทึกชุดตัวเลือกเรียบร้อย" : "สร้างชุดตัวเลือกเรียบร้อย");
        onSaved(String(out.item?._id || set?._id || ""));
        return;
      }
      // linked menus: preview, then confirm
      const { res, out } = await write("POST", `/api/admin/food/option-sets/${idStr(set._id)}/preview`);
      if (!res.ok) {
        setError(out.error || "ตรวจสอบผลกระทบไม่สำเร็จ");
        return;
      }
      if (out.impact?.blocking?.length) {
        setError(
          `บันทึกไม่ได้: ${out.impact.blocking.map((b) => `${b.menuName} — ${b.reason}`).join(" · ")}`,
        );
        return;
      }
      setImpact(out.impact);
      setSub("confirm");
    } catch (err) {
      console.error(err);
      setError("บันทึกชุดตัวเลือกไม่สำเร็จ");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function confirmSave() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const { res, out } = await write("PUT", `/api/admin/food/option-sets/${idStr(set._id)}`);
      if (!res.ok) {
        // e.g. 422: back to the form with the server's message
        setSub(null);
        setError(out.error || "บันทึกชุดตัวเลือกไม่สำเร็จ");
        return;
      }
      toast.success(`บันทึกและอัปเดต ${out.impact?.menus?.length ?? 0} เมนูเรียบร้อย`);
      onSaved(String(set._id));
    } catch (err) {
      console.error(err);
      setSub(null);
      setError("บันทึกชุดตัวเลือกไม่สำเร็จ");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const show = (k) => touched && errors[k];

  return (
    <>
      <Dialog open={!sub} onOpenChange={(o) => !o && requestClose()}>
        <DialogContent className="flex max-h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] max-w-[900px] flex-col gap-0 rounded-2xl bg-white p-0">
          <div className="border-b border-admin-border px-5 py-4 pr-12">
            <DialogTitle className="text-lg">{isEdit ? "แก้ไขชุดตัวเลือก" : "สร้างชุดตัวเลือก"}</DialogTitle>
            <DialogDescription className="sr-only">ตั้งชื่อชุด รูปแบบการเลือก และตัวเลือกในชุด</DialogDescription>
          </div>

          <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">
                    ชื่อชุด <span className="text-red-500">*</span>
                  </span>
                  <input
                    value={form.name}
                    onChange={(e) => patch({ name: e.target.value.slice(0, OPTION_SET_NAME_MAX) })}
                    onBlur={() => setTouched(true)}
                    placeholder="เช่น แบบเสิร์ฟ"
                    autoFocus
                    className={`mt-1 ${inputCls} ${show("name") ? "border-red-400" : "border-admin-border"}`}
                  />
                  <span className="mt-1 block text-xs text-admin-textMuted">
                    ผู้เรียนเห็นชื่อนี้เป็นหัวข้อกลุ่ม เช่น &quot;แบบเสิร์ฟ: Set&quot;
                  </span>
                  {show("name") && <span className="mt-1 block text-xs text-red-600">{errors.name}</span>}
                </label>

                <div>
                  <span id="os-select-type" className="text-sm font-medium">
                    รูปแบบการเลือก
                  </span>
                  {/* same segmented look as the wizard's option tabs */}
                  <div
                    role="radiogroup"
                    aria-labelledby="os-select-type"
                    className="mt-1 grid grid-cols-2 rounded-xl bg-admin-surfaceMuted p-1 text-sm"
                  >
                    {[
                      ["single", "เลือกได้ 1"],
                      ["multi", "เลือกได้หลายอย่าง"],
                    ].map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={form.selectType === v}
                        onClick={() => patch({ selectType: v })}
                        className={`truncate rounded-lg px-2 py-2 transition ${
                          form.selectType === v
                            ? "bg-white font-semibold text-brand-primaryDark shadow-sm"
                            : "text-admin-textMuted hover:text-admin-text"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.required}
                      onChange={(e) => patch({ required: e.target.checked })}
                      className="h-4 w-4 accent-[#0099CC]"
                    />
                    บังคับเลือก
                  </label>
                </div>
              </div>

              <fieldset className="rounded-xl border border-dashed border-admin-border p-3">
                <legend className="px-1 text-sm font-medium">จำนวนที่เลือกได้</legend>
                <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
                  {[
                    ["minSelect", "ต่ำสุด", 0],
                    ["maxSelect", "สูงสุด", 1],
                  ].map(([k, label, min]) => (
                    <label key={k} className="block text-xs text-admin-textMuted">
                      {label}
                      <input
                        type="number"
                        inputMode="numeric"
                        min={min}
                        step={1}
                        value={multi ? form[k] : ""}
                        disabled={!multi}
                        onChange={(e) => patch({ [k]: e.target.value })}
                        placeholder="ไม่จำกัด"
                        className={`mt-1 ${inputCls} ${errors.limits ? "border-red-400" : "border-admin-border"}`}
                      />
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-admin-textMuted">
                  {multi ? "เว้นว่าง = ไม่จำกัด" : "ใช้ได้เฉพาะแบบเลือกได้หลายอย่าง"}
                </p>
                {errors.limits && <p className="mt-1 text-xs text-red-600">{errors.limits}</p>}
              </fieldset>

              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">ตัวเลือกในชุด ({form.choices.length})</h3>
                  <button
                    type="button"
                    onClick={() => patch({ choices: [...form.choices, emptyChoice()] })}
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-primary/60 bg-white px-2.5 py-1 text-xs text-brand-primaryDark hover:bg-brand-primary/10"
                  >
                    <Plus className="h-3.5 w-3.5" /> เพิ่มตัวเลือก
                  </button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-admin-border">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="bg-admin-surfaceMuted text-left text-xs text-admin-textMuted">
                      <tr>
                        <th className="w-14 px-2 py-2">
                          <span className="sr-only">ลำดับ</span>
                        </th>
                        <th className="px-2 py-2 font-medium">ชื่อตัวเลือก</th>
                        <th className="w-40 px-2 py-2 font-medium">ราคาเพิ่มเริ่มต้น (บาท)</th>
                        <th className="w-20 px-2 py-2 text-center font-medium">เปิดใช้</th>
                        <th className="w-12 px-2 py-2">
                          <span className="sr-only">ลบ</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.choices.map((c, i) => (
                        <tr
                          key={c._key}
                          draggable
                          onDragStart={(e) => {
                            setDragKey(c._key);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragOver={(e) => {
                            if (!dragKey || dragKey === c._key) return;
                            e.preventDefault();
                            const from = form.choices.findIndex((x) => x._key === dragKey);
                            if (from >= 0) moveChoice(from, i);
                          }}
                          onDrop={(e) => e.preventDefault()}
                          onDragEnd={() => setDragKey("")}
                          className={`border-t border-admin-border/60 ${dragKey === c._key ? "bg-brand-primary/10" : ""}`}
                        >
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-0.5">
                              <GripVertical className="h-4 w-4 cursor-grab text-admin-textMuted" aria-hidden />
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  onClick={() => moveChoice(i, i - 1)}
                                  disabled={i === 0}
                                  aria-label={`เลื่อน ${c.name || "ตัวเลือก"} ขึ้น`}
                                  className="rounded hover:bg-admin-surfaceMuted disabled:opacity-30"
                                >
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveChoice(i, i + 1)}
                                  disabled={i === form.choices.length - 1}
                                  aria-label={`เลื่อน ${c.name || "ตัวเลือก"} ลง`}
                                  className="rounded hover:bg-admin-surfaceMuted disabled:opacity-30"
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              value={c.name}
                              onChange={(e) => patchChoice(c._key, { name: e.target.value })}
                              placeholder="เช่น Set (ข้าว + เครื่องดื่ม)"
                              aria-label={`ชื่อตัวเลือกที่ ${i + 1}`}
                              className={`${inputCls} ${touched && !c.name.trim() ? "border-red-400" : "border-admin-border"}`}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              value={c.priceDelta}
                              onChange={(e) => patchChoice(c._key, { priceDelta: e.target.value })}
                              aria-label={`ราคาเพิ่มเริ่มต้นของ ${c.name || `ตัวเลือกที่ ${i + 1}`}`}
                              className={`${inputCls} border-admin-border`}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <Toggle
                              checked={c.isActive}
                              onChange={(v) => patchChoice(c._key, { isActive: v })}
                              label={`เปิดใช้ ${c.name || `ตัวเลือกที่ ${i + 1}`}`}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => patch({ choices: form.choices.filter((x) => x._key !== c._key) })}
                              aria-label={`ลบ ${c.name || `ตัวเลือกที่ ${i + 1}`}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {form.choices.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-xs text-admin-textMuted">
                            ยังไม่มีตัวเลือก
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {show("choices") && <p className="mt-2 text-xs text-red-600">{errors.choices}</p>}
              </section>

              {isEdit && (
                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">เมนูที่ใช้ชุดนี้ ({linkedMenus.length})</h3>
                    <button
                      type="button"
                      onClick={() => setSub("attach")}
                      className="rounded-lg border border-brand-primary/60 bg-white px-2.5 py-1 text-xs text-brand-primaryDark hover:bg-brand-primary/10"
                    >
                      ใช้กับเมนู…
                    </button>
                  </div>
                  {linkedMenus.length ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {linkedMenus.map((m) => (
                          <span
                            key={m._id}
                            className={`rounded-md px-2 py-0.5 text-xs ${
                              m.hasOverride
                                ? "bg-amber-100 text-amber-800"
                                : "bg-brand-primary/15 text-brand-primaryDark"
                            }`}
                          >
                            {m.hasOverride ? overrideChipText(m) : m.name}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-admin-textMuted">
                        สีเหลือง = เมนูนั้นตั้งราคาเอง จะไม่เปลี่ยนตามราคาเริ่มต้นของชุด
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-admin-textMuted">ยังไม่ได้ใช้กับเมนูไหน</p>
                  )}
                </section>
              )}

              {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-admin-border px-5 py-4">
              <div>
                {isEdit && (
                  <button
                    type="button"
                    onClick={() => setSub("delete")}
                    disabled={saving}
                    className="rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    ลบชุด
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={requestClose}
                  disabled={saving}
                  className="rounded-xl border border-admin-border bg-white px-5 py-2.5 text-sm font-medium hover:bg-admin-surfaceMuted disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primaryDark px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  บันทึก
                </button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {sub === "confirm" && impact && (
        <OptionSetConfirmModal
          open
          before={set}
          after={payload}
          impact={impact}
          usageMenus={linkedMenus}
          saving={saving}
          onBack={() => setSub(null)}
          onConfirm={confirmSave}
        />
      )}
      {sub === "attach" && (
        <OptionSetAttachModal
          set={set}
          menus={menus}
          categories={categories}
          onClose={() => setSub(null)}
          onAttached={async () => {
            setSub(null);
            await onChanged?.();
          }}
        />
      )}
      {sub === "delete" && (
        <OptionSetDeleteDialog set={set} onClose={() => setSub(null)} onDeleted={onDeleted} />
      )}
    </>
  );
}
