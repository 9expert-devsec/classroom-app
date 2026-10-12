"use client";

import { useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, X } from "lucide-react";
import { safeJson } from "../menuUi";
import StepInfo from "./StepInfo";
import StepOptions from "./StepOptions";
import StepReview from "./StepReview";
import { buildPayload, infoErrors, initialForm, optionsError, snapshot } from "./wizardModel";

const STEPS = ["ข้อมูลเมนู", "ตัวเลือกเพิ่มเติม", "ตรวจสอบและยืนยัน"];

function Stepper({ step, canGo, onGo }) {
  return (
    <ol className="flex items-start">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const current = n === step;
        const done = n < step;
        const clickable = !current && canGo(n);
        return (
          <li key={label} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${
                  n <= step ? "bg-brand-primaryDark" : "bg-admin-border"
                }`}
              />
            )}
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onGo(n)}
              aria-current={current ? "step" : undefined}
              className={[
                "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition",
                current
                  ? "border-brand-primaryDark bg-brand-primaryDark text-white"
                  : done
                    ? "border-brand-primaryDark bg-white text-brand-primaryDark"
                    : "border-admin-border bg-white text-admin-textMuted",
                clickable ? "cursor-pointer hover:bg-brand-primary/10" : "cursor-default",
              ].join(" ")}
            >
              {done ? <Check className="h-4 w-4" /> : n}
            </button>
            <span
              className={`mt-1 text-[11px] ${
                current ? "font-semibold text-brand-primaryDark" : "text-admin-textMuted"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const btn = {
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-xl border border-admin-border bg-white px-4 py-2.5 text-sm font-medium hover:bg-admin-surfaceMuted disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-primaryDark bg-white px-4 py-2.5 text-sm font-semibold text-brand-primaryDark hover:bg-brand-primary/10 disabled:opacity-50",
  primary:
    "inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primaryDark px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50",
};

/**
 * Add / edit menu wizard. Mounted only while open.
 * menu = null -> create. onSaved(menuId) after a successful save.
 */
export default function MenuWizard({
  restaurantId,
  menu,
  nextSortOrder,
  categories,
  addons,
  drinks,
  uploadImage,
  onClose,
  onSaved,
}) {
  const isEdit = !!menu;
  const [initial] = useState(() => initialForm(menu, nextSortOrder));
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(isEdit ? 3 : 1);
  const [showErrors, setShowErrors] = useState({});
  const [optError, setOptError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive !== false).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [categories],
  );
  const activeCategoryIds = useMemo(
    () => new Set(activeCategories.map((c) => String(c._id))),
    [activeCategories],
  );
  const hiddenCategoryCount = form.categoryIds.filter((id) => !activeCategoryIds.has(id)).length;

  const errors = infoErrors(form, {
    activeCategoryIds,
    needsCategory: activeCategories.length > 0,
  });
  const infoValid = Object.keys(errors).length === 0;
  const dirty = snapshot(form) !== snapshot(initial);

  function revealInfoErrors() {
    setShowErrors(Object.fromEntries(Object.keys(errors).map((k) => [k, true])));
  }

  // every changed field shows its own error right away
  const shown = useMemo(() => {
    const out = { ...showErrors };
    for (const k of ["name", "price", "sortOrder", "description"]) {
      if (form[k] !== initial[k]) out[k] = true;
    }
    if (form.categoryIds.join() !== initial.categoryIds.join()) out.categoryIds = true;
    return out;
  }, [showErrors, form, initial]);

  function goTo(n) {
    setSaveError("");
    setStep(n);
    setMaxStep((m) => Math.max(m, n));
  }

  function next() {
    if (step === 1) {
      if (!infoValid) return revealInfoErrors();
      return goTo(2);
    }
    if (step === 2) {
      const e = optionsError(form);
      setOptError(e);
      if (!e) goTo(3);
    }
  }

  // create: back to completed steps only. edit: any step.
  const canGo = (n) => !saving && (isEdit || n <= maxStep);

  function requestClose() {
    if (saving) return;
    if (dirty && !confirm("ปิดหน้าต่างนี้? การเปลี่ยนแปลงที่ยังไม่ได้บันทึกจะหายไป")) return;
    onClose();
  }

  async function save(isActive) {
    if (savingRef.current) return;
    // validate everything; jump to the first step that fails
    if (!infoValid) {
      revealInfoErrors();
      setStep(1);
      return;
    }
    const oe = optionsError(form);
    setOptError(oe);
    if (oe) {
      setStep(2);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const payload = buildPayload(form, {
        restaurantId,
        activeAddonIds: new Set(addons.map((a) => String(a._id))),
        activeDrinkIds: new Set(drinks.map((d) => String(d._id))),
        isActive: isEdit ? undefined : isActive,
      });
      const res = await fetch(isEdit ? `/api/admin/food/menu/${menu._id}` : "/api/admin/food/menu", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const out = await safeJson(res);
      if (!res.ok) {
        console.error(out);
        setSaveError(out.error || "บันทึกเมนูไม่สำเร็จ");
        return;
      }
      toast.success(
        isEdit
          ? "บันทึกการเปลี่ยนแปลงเรียบร้อย"
          : isActive
            ? "เพิ่มเมนูเรียบร้อย"
            : "บันทึกเมนูแบบปิดใช้งานเรียบร้อย",
      );
      onSaved(String(out.item?._id || menu?._id || ""));
    } catch (err) {
      console.error(err);
      setSaveError("บันทึกเมนูไม่สำเร็จ");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const saveLabel = saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null;

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && requestClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/50" />
        <DialogPrimitive.Content
          onInteractOutside={(e) => saving && e.preventDefault()}
          className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[92svh] sm:w-[calc(100vw-2rem)] sm:max-w-4xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:shadow-2xl"
        >
          {/* header */}
          <div className="flex items-center justify-between gap-3 border-b border-admin-border px-5 py-4">
            <DialogPrimitive.Title className="text-lg font-bold">
              {isEdit ? "แก้ไขเมนูอาหาร" : "เพิ่มเมนูอาหาร"}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              กรอกข้อมูลเมนู ตัวเลือกเพิ่มเติม แล้วตรวจสอบก่อนบันทึก
            </DialogPrimitive.Description>
            <button
              type="button"
              onClick={requestClose}
              disabled={saving}
              aria-label="ปิด"
              className="rounded-full p-1.5 text-admin-textMuted hover:bg-admin-surfaceMuted disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="border-b border-admin-border px-5 py-3">
            <Stepper step={step} canGo={canGo} onGo={goTo} />
          </div>

          {/* body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {step === 1 && (
              <StepInfo
                form={form}
                set={set}
                errors={errors}
                showErrors={shown}
                activeCategories={activeCategories}
                hiddenCategoryCount={hiddenCategoryCount}
                uploadImage={uploadImage}
              />
            )}
            {step === 2 && (
              <StepOptions form={form} set={set} addons={addons} drinks={drinks} error={optError} />
            )}
            {step === 3 && (
              <StepReview
                form={form}
                categories={categories}
                addons={addons}
                drinks={drinks}
                onEditInfo={() => goTo(1)}
                error=""
              />
            )}
            {saveError && (
              <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{saveError}</p>
            )}
          </div>

          {/* footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-admin-border px-5 py-4">
            {step === 1 ? (
              <button type="button" onClick={requestClose} disabled={saving} className={btn.ghost}>
                ยกเลิก
              </button>
            ) : (
              <button type="button" onClick={() => goTo(step - 1)} disabled={saving} className={btn.ghost}>
                <ArrowLeft className="h-4 w-4" /> ย้อนกลับ
              </button>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {step < 3 && (
                <button
                  type="button"
                  onClick={next}
                  disabled={saving}
                  className={isEdit ? btn.secondary : btn.primary}
                >
                  ถัดไป <ArrowRight className="h-4 w-4" />
                </button>
              )}

              {isEdit && (
                <button type="button" onClick={() => save()} disabled={saving} className={btn.primary}>
                  {saveLabel}
                  บันทึกการเปลี่ยนแปลง
                </button>
              )}

              {!isEdit && step === 3 && (
                <>
                  <button type="button" onClick={() => save(false)} disabled={saving} className={btn.secondary}>
                    บันทึกแบบปิดใช้งาน
                  </button>
                  <button type="button" onClick={() => save(true)} disabled={saving} className={btn.primary}>
                    {saveLabel || <Check className="h-4 w-4" />}
                    ยืนยันการเพิ่มเมนู
                  </button>
                </>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
