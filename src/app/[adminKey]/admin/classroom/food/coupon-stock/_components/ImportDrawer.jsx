"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { bangkokTodayYMD } from "@/lib/classDates";
import { classifyLinesLocal, MAX_IMPORT_CODES } from "@/lib/couponStockCode";
import { isLotCancelled, lotKey, parseLotKey, safeJson } from "./stockUi";
import { sortLots } from "./LotCards";
import { StepCodes, StepLot, StepReview } from "./ImportSteps";

const STEPS = ["ข้อมูลล็อต", "วางรหัสคูปอง", "ตรวจสอบและยืนยัน"];

function Stepper({ step, onGo, locked }) {
  return (
    <ol className="flex items-start">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        const clickable = done && !locked;
        return (
          <li key={label} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span
                className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${
                  n <= step ? "bg-brand-primaryDark" : "bg-admin-border"
                }`}
                aria-hidden
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
                    ? "border-brand-primaryDark bg-white text-brand-primaryDark hover:bg-brand-primary/10"
                    : "border-admin-border bg-white text-admin-textMuted",
                clickable ? "cursor-pointer" : "cursor-default",
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

/**
 * Mounted only while open, so every open starts from a clean form.
 * onImported({ restaurantId, lotKey }) runs after a successful import.
 */
export default function ImportDrawer({ restaurants, initialRestaurantId, onClose, onImported }) {
  const today = bangkokTodayYMD();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    restaurantId: initialRestaurantId || String(restaurants[0]?._id || ""),
    importType: "new",
    batchName: "",
    expiresYMD: "",
    note: "",
    existingLot: "",
  });
  const [touchedState, setTouchedState] = useState({});

  const [mode, setMode] = useState("paste");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [codesText, setCodesText] = useState("");
  const [fileName, setFileName] = useState("");

  const [preview, setPreview] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submittingRef = useRef(false);

  /* ---------- lots of the shop chosen in the drawer ---------- */
  const [lotsState, setLotsState] = useState({ shop: "", lots: null });
  useEffect(() => {
    if (!form.restaurantId) return;
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/food/coupon-stock/summary?restaurantId=${encodeURIComponent(form.restaurantId)}`,
          { cache: "no-store" },
        );
        const data = await safeJson(res);
        if (ignore) return;
        if (!res.ok) {
          toast.error(data.error || "โหลดข้อมูลล็อตไม่สำเร็จ");
          return;
        }
        setLotsState({ shop: form.restaurantId, lots: data.batches || [] });
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [form.restaurantId]);

  const allLots = lotsState.shop === form.restaurantId ? lotsState.lots : null;
  const namedLots = useMemo(
    // R5-3: ล็อตที่ยกเลิกแล้วรับรหัสเพิ่มไม่ได้ (server ก็ปฏิเสธ) — ไม่ให้เลือก
    () => sortLots((allLots || []).filter((b) => b.importBatch && !isLotCancelled(b))),
    [allLots],
  );

  /* ---------- derived lot target ---------- */
  const isNew = form.importType === "new";
  const picked = parseLotKey(form.existingLot);
  const importBatch = isNew ? form.batchName.trim() : picked?.batch || "";
  const expiresYMD = isNew ? form.expiresYMD : picked?.expiresYMD || "";
  const shopName =
    restaurants.find((r) => String(r._id) === form.restaurantId)?.name || "";

  const errors = {};
  if (isNew) {
    if (!importBatch) errors.batchName = "กรุณาระบุชื่อล็อต";
    // ชื่อล็อตห้ามซ้ำแบบไม่สนตัวพิมพ์ (ตรงกับ server) — รวมล็อตที่ยกเลิกแล้ว
    else if (
      (allLots || []).some(
        (b) => (b.importBatch || "").toLowerCase() === importBatch.toLowerCase(),
      )
    )
      errors.batchName = "ชื่อล็อตนี้มีอยู่แล้วในร้านนี้";
    if (!form.expiresYMD) errors.expiresYMD = "กรุณาระบุวันหมดอายุ";
    else if (form.expiresYMD < today)
      errors.expiresYMD = "วันหมดอายุต้องเป็นวันนี้หรือหลังจากนี้";
  } else if (!picked) {
    errors.existingLot = "กรุณาเลือกล็อต";
  }
  const touched = {
    ...touchedState,
    batchName: touchedState.batchName || !!form.batchName,
    expiresYMD: touchedState.expiresYMD || !!form.expiresYMD,
  };
  const step1Valid =
    !!form.restaurantId && allLots !== null && Object.keys(errors).length === 0;

  /* ---------- live code counter (same rules as the server) ---------- */
  const local = useMemo(() => {
    const { lines, rows } = classifyLinesLocal(codesText);
    return { lines, duplicates: rows.filter((r) => r.result === "duplicate").length };
  }, [codesText]);
  const tooMany = local.lines.length > MAX_IMPORT_CODES;
  const step2Valid = local.lines.length > 0 && !tooMany;

  const dirty = !!(
    form.batchName.trim() ||
    form.note.trim() ||
    form.existingLot ||
    codesText.trim()
  );

  function requestClose() {
    if (saving) return;
    // R5-4: ถามด้วย dialog แทน window.confirm
    if (dirty) return setConfirmDiscard(true);
    onClose();
  }

  function payload() {
    return {
      restaurantId: form.restaurantId,
      importType: form.importType,
      importBatch,
      expiresYMD,
      note: form.note.trim(),
      codesText,
    };
  }

  async function runCheck() {
    if (!step2Valid || checking) return;
    setChecking(true);
    setCheckError("");
    try {
      const res = await fetch("/api/admin/food/coupon-stock/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        console.error(data);
        setCheckError(data.error || "ตรวจสอบไม่สำเร็จ");
        return;
      }
      setPreview(data);
      setSubmitError("");
      setStep(3);
    } catch (err) {
      console.error(err);
      setCheckError("ตรวจสอบไม่สำเร็จ");
    } finally {
      setChecking(false);
    }
  }

  async function submit() {
    const n = preview?.counts?.valid || 0;
    if (n === 0 || submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/admin/food/coupon-stock/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        console.error(data);
        setSubmitError(data.error || "นำเข้าไม่สำเร็จ");
        return;
      }

      // the dry run is advisory: someone may have added a code in between
      const raced = Math.max(0, (data.counts?.exists || 0) - (preview.counts.exists || 0));
      toast.success(`นำเข้าคูปอง ${data.inserted} รายการเรียบร้อย`, {
        description: raced
          ? `ข้าม ${raced} รายการที่ถูกเพิ่มเข้าระบบระหว่างตรวจสอบ`
          : undefined,
      });
      onImported({
        restaurantId: form.restaurantId,
        lotKey: lotKey(importBatch, expiresYMD),
      });
    } catch (err) {
      console.error(err);
      setSubmitError("นำเข้าไม่สำเร็จ");
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  const recap = [
    shopName,
    `ล็อต ${importBatch || "—"}`,
    `หมดอายุ ${expiresYMD || "—"}`,
    isNew ? "สร้างล็อตใหม่" : "เพิ่มในล็อตเดิม",
  ].join(" · ");

  const validCount = preview?.counts?.valid || 0;

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/40" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-admin-bg shadow-2xl outline-none sm:max-w-lg"
          onInteractOutside={(e) => {
            if (saving) e.preventDefault();
          }}
        >
          {/* header */}
          <div className="flex items-start justify-between gap-3 border-b border-admin-border bg-white px-5 py-4">
            <div>
              <DialogPrimitive.Title className="text-lg font-bold">
                นำเข้าคูปองอาหาร
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-xs text-admin-textMuted">
                เพิ่มคูปองอาหารเข้าสู่ระบบ โดยระบุข้อมูลล็อตและวันหมดอายุ
              </DialogPrimitive.Description>
            </div>
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

          <div className="border-b border-admin-border bg-white px-5 py-3">
            <Stepper step={step} onGo={setStep} locked={checking || saving} />
          </div>

          {/* body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              {step === 1 && (
                <StepLot
                  form={form}
                  setForm={setForm}
                  restaurants={restaurants}
                  lots={namedLots}
                  today={today}
                  errors={errors}
                  touched={touched}
                  touch={(k) => setTouchedState((t) => ({ ...t, [k]: true }))}
                />
              )}
              {step === 2 && (
                <>
                  <StepCodes
                    codesText={codesText}
                    setCodesText={setCodesText}
                    mode={mode}
                    setMode={setMode}
                    fileName={fileName}
                    setFileName={setFileName}
                    local={local}
                    tooMany={tooMany}
                  />
                  {checkError && (
                    <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{checkError}</p>
                  )}
                </>
              )}
              {step === 3 && <StepReview preview={preview} recap={recap} error={submitError} />}
            </div>
          </div>

          {/* footer */}
          <div className="flex gap-3 border-t border-admin-border bg-white px-5 py-4">
            {step === 1 ? (
              <button
                type="button"
                onClick={requestClose}
                className="flex-1 rounded-xl border border-admin-border bg-white py-2.5 text-sm font-medium hover:bg-admin-surfaceMuted"
              >
                ยกเลิก
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                disabled={checking || saving}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-admin-border bg-white py-2.5 text-sm font-medium hover:bg-admin-surfaceMuted disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" /> ย้อนกลับ
              </button>
            )}

            {step === 1 && (
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-primaryDark py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ถัดไป <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                onClick={runCheck}
                disabled={!step2Valid || checking}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-primaryDark py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> กำลังตรวจสอบ...
                  </>
                ) : (
                  <>
                    ตรวจสอบคูปอง <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                onClick={submit}
                disabled={validCount === 0 || saving}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-primaryDark py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> กำลังนำเข้า...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" /> ยืนยันนำเข้า ({validCount.toLocaleString()} รายการ)
                  </>
                )}
              </button>
            )}
          </div>

          {/* ซ้อนอยู่ใน Content เพื่อให้คลิกใน dialog นี้ไม่นับเป็นการคลิกนอก drawer */}
          {confirmDiscard && (
            <Dialog open onOpenChange={(o) => !o && setConfirmDiscard(false)}>
              <DialogContent className="max-w-md rounded-2xl bg-white">
                <DialogTitle className="text-lg">ปิดหน้าต่างนำเข้า?</DialogTitle>
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
                  <DialogDescription className="text-sm text-admin-text">
                    ข้อมูลที่กรอกไว้จะหายไป
                  </DialogDescription>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmDiscard(false)}
                    className="flex-1 rounded-xl border border-admin-border bg-white py-2.5 text-sm font-medium hover:bg-admin-surfaceMuted"
                  >
                    กลับไปกรอกต่อ
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    ปิดและล้างข้อมูล
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
