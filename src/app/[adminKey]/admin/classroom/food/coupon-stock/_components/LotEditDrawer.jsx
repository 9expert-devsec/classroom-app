"use client";

// R5-3: drawer "แก้ไขล็อต" — ทุกครั้งที่แก้ช่องไหน (หน่วง 400ms) ขอ /lots/impact มาแสดงผลกระทบ
// ปุ่มบันทึกส่ง impactHash ของ preview ล่าสุด — server คำนวณใหม่ ไม่ตรง = 409 impact_changed -> preview ใหม่
import { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { AlertCircle, AlertTriangle, Check, Info, Loader2, X } from "lucide-react";
import { IMPACT_CHANGED_MSG, lotApi, lotKey, lotLabel } from "./stockUi";

const inputCls =
  "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-admin-text outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";

const PREVIEW_DELAY_MS = 400;

function Label({ children }) {
  return <span className="text-sm font-medium text-admin-text">{children}</span>;
}

function countBy(rows, fn) {
  return rows.filter(fn).length;
}

function ImpactSummary({ impact }) {
  const { counts, edit } = impact;
  const rows = impact.codes || [];
  const expiryEdited = !!edit?.expiryCodes && edit.expiryChanged;

  // R5-3a: grid 2 คอลัมน์ (หัวข้อ | ค่า) — "เปลี่ยน" กับ "คงเดิม" ตรงกัน และวงเล็บตัดบรรทัดใต้ค่าของตัวเอง
  return (
    <div className="space-y-2 rounded-xl bg-admin-surfaceMuted p-3 text-sm">
      <div className="font-semibold text-admin-text">ทั้งหมด {counts.total} ใบ</div>

      {(edit?.nameChanged || expiryEdited) && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-left">
          {edit?.nameChanged && (
            <>
              <dt className="font-medium">ชื่อล็อต:</dt>
              <dd>เปลี่ยนทุกใบ ({edit.renameCodes.length} ใบ)</dd>
            </>
          )}

          {expiryEdited && (
            <>
              <dt className="font-medium">วันหมดอายุ:</dt>
              <dd>
                เปลี่ยน {edit.expiryCodes.length} ใบ
                <div className="text-xs text-admin-textMuted">
                  (ยังไม่ใช้ {countBy(rows, (r) => r.bucket === "unused" && !r.staleAssigned)} · ยกเลิกรายใบ{" "}
                  {countBy(rows, (r) => r.bucket === "void")} · จองแล้วรอส่งมอบ{" "}
                  {countBy(rows, (r) => r.bucket === "active")} · ค้างจองข้ามวัน{" "}
                  {countBy(rows, (r) => r.staleAssigned)})
                </div>
              </dd>
              <dt aria-hidden />
              <dd>
                คงเดิม {edit.keepExpiryCodes.length} ใบ
                <div className="text-xs text-admin-textMuted">
                  (ส่งมอบแล้ว {countBy(rows, (r) => r.status === "handed_out")} · รอคืนเข้าคลัง{" "}
                  {countBy(rows, (r) => r.status === "awaiting_return")})
                </div>
              </dd>
            </>
          )}
        </dl>
      )}

      {expiryEdited && (
        <p className="flex gap-1.5 text-xs text-admin-textMuted">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          คูปองที่ส่งมอบแล้วถือว่าใช้แล้ว วันหมดอายุคงตามกระดาษ
        </p>
      )}
    </div>
  );
}

function Blockers({ blockers }) {
  return (
    <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <div className="flex gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div>
          วันหมดอายุใหม่เร็วกว่าวันเรียนของผู้เรียนเหล่านี้ ({blockers.length} ใบ) — ย้ายร้านหรือยกเลิกออเดอร์เหล่านี้ก่อน
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg bg-white">
        <table className="w-full text-xs text-admin-text">
          <thead className="bg-admin-surfaceMuted text-left text-admin-textMuted">
            <tr>
              <th className="px-2 py-1.5 font-medium">รหัส</th>
              <th className="px-2 py-1.5 font-medium">วันเรียน</th>
              <th className="px-2 py-1.5 font-medium">ผู้เรียน</th>
            </tr>
          </thead>
          <tbody>
            {blockers.map((b) => (
              <tr key={b.orderId || b.code} className="border-t border-admin-border/60">
                <td className="px-2 py-1.5 font-mono">{b.code}</td>
                <td className="px-2 py-1.5">{b.dayYMD}</td>
                <td className="px-2 py-1.5">{b.learnerLabel || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Mounted only while open.
 * onSaved({ oldKey, newKey }) after a successful save (caller refreshes summary + table).
 */
export default function LotEditDrawer({ lot, today, onClose, onSaved }) {
  const origName = lot.importBatch || "";
  const origExpiry = lot.expiresYMD || "";

  const [name, setName] = useState(origName);
  const [expiry, setExpiry] = useState(origExpiry);

  const [preview, setPreview] = useState(null); // { key, impact }
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const seq = useRef(0);

  // ส่งเฉพาะช่องที่เปลี่ยนจริง — ล็อตไม่มีชื่อจะได้แก้แค่วันหมดอายุได้
  const body = useMemo(() => {
    const b = { lotId: lot.lotId, action: "edit" };
    if (name.trim() !== origName) b.newName = name.trim();
    if (expiry && expiry !== origExpiry) b.newExpiresYMD = expiry;
    return b;
  }, [lot.lotId, name, expiry, origName, origExpiry]);
  const inputKey = JSON.stringify(body);
  const hasChange = "newName" in body || "newExpiresYMD" in body;
  const localError = !expiry ? "กรุณาระบุวันหมดอายุ" : "";

  useEffect(() => {
    if (!hasChange || localError) {
      setPreview(null);
      setPreviewing(false);
      return undefined;
    }
    const mine = ++seq.current;
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        const { ok, data } = await lotApi("/impact", JSON.parse(inputKey));
        if (mine !== seq.current) return;
        if (!ok) {
          setPreviewError(data.error || "ตรวจสอบผลกระทบไม่สำเร็จ");
          setPreview(null);
          return;
        }
        setPreviewError("");
        setPreview({ key: inputKey, impact: data.impact });
      } catch (err) {
        console.error(err);
        if (mine === seq.current) setPreviewError("ตรวจสอบผลกระทบไม่สำเร็จ");
      } finally {
        if (mine === seq.current) setPreviewing(false);
      }
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(t);
  }, [inputKey, hasChange, localError, refreshTick]);

  const impact = preview?.key === inputKey ? preview.impact : null;
  const fresh = !!impact && !previewing;
  const somethingChanges = !!impact && (impact.edit?.nameChanged || impact.edit?.expiryChanged);
  const canSave = hasChange && fresh && impact.ok && somethingChanges && !saving && !localError;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setSaveError("");
    setNotice("");
    try {
      const payload = { ...JSON.parse(inputKey), impactHash: impact.impactHash };
      delete payload.action;
      const { ok, data } = await lotApi("", payload, "PATCH");
      if (ok) {
        toast.success(`บันทึกล็อตแล้ว — เปลี่ยน ${data.changed} ใบ`);
        onSaved({
          oldKey: lotKey(origName, origExpiry),
          newKey: lotKey(data.lot?.name ?? origName, data.lot?.expiresYMD ?? origExpiry),
        });
        return;
      }
      if (data.code === "impact_changed") {
        setNotice(IMPACT_CHANGED_MSG);
        setRefreshTick((n) => n + 1);
        return;
      }
      setSaveError(data.error || "บันทึกไม่สำเร็จ");
      // blockers / ชื่อซ้ำที่เกิดระหว่างนี้ -> ให้ preview แสดงรายละเอียดล่าสุด
      setRefreshTick((n) => n + 1);
    } catch (err) {
      console.error(err);
      setSaveError("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const fieldErr = (field) => (impact?.errors || []).find((e) => e.field === field)?.message || "";
  const nameErr = fieldErr("name");
  const expiryErr = localError || fieldErr("expiresYMD");
  const otherErrors = (impact?.errors || []).filter((e) => e.field !== "name" && e.field !== "expiresYMD");

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
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
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-bold">แก้ไขล็อต</DialogPrimitive.Title>
              <DialogPrimitive.Description className="truncate text-xs text-admin-textMuted">
                {lotLabel(origName)} · หมดอายุ {origExpiry || "—"} · {lot.total} ใบ
              </DialogPrimitive.Description>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              aria-label="ปิด"
              className="rounded-full p-1.5 text-admin-textMuted hover:bg-admin-surfaceMuted disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-5 rounded-2xl bg-white p-4 shadow-sm">
              <label className="block">
                <Label>ชื่อล็อต</Label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={origName ? "" : "ไม่ระบุล็อต — ตั้งชื่อได้"}
                  maxLength={100}
                  className={`${inputCls} ${nameErr ? "border-red-400" : "border-admin-border"}`}
                />
                {nameErr ? (
                  <p className="mt-1 text-xs text-red-600">{nameErr}</p>
                ) : (
                  <p className="mt-1 text-xs text-admin-textMuted">เปลี่ยนชื่อมีผลกับทุกใบในล็อต</p>
                )}
              </label>

              <label className="block">
                <Label>วันหมดอายุ</Label>
                <input
                  type="date"
                  value={expiry}
                  min={today}
                  onChange={(e) => setExpiry(e.target.value)}
                  className={`${inputCls} ${expiryErr ? "border-red-400" : "border-admin-border"}`}
                />
                {expiryErr ? (
                  <p className="mt-1 text-xs text-red-600">{expiryErr}</p>
                ) : (
                  <p className="mt-1 text-xs text-admin-textMuted">
                    มีผลกับใบที่ยังไม่ใช้และใบที่จองไว้ — ใบที่ส่งมอบแล้วคงวันเดิม
                  </p>
                )}
              </label>

              {/* impact */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  ผลกระทบ
                  {previewing && <Loader2 className="h-4 w-4 animate-spin text-admin-textMuted" />}
                </div>

                {notice && (
                  <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                    {notice}
                  </div>
                )}

                {!hasChange ? (
                  <p className="text-sm text-admin-textMuted">ยังไม่มีการเปลี่ยนแปลง</p>
                ) : previewError ? (
                  <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{previewError}</p>
                ) : impact ? (
                  <>
                    <ImpactSummary impact={impact} />
                    {impact.warnings.map((w) => (
                      <div key={w.code} className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                        {w.message}
                      </div>
                    ))}
                    {otherErrors.map((e) => (
                      <p key={e.code} className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                        {e.message}
                      </p>
                    ))}
                    {impact.blockers.length > 0 && <Blockers blockers={impact.blockers} />}
                  </>
                ) : (
                  !localError && <p className="text-sm text-admin-textMuted">กำลังตรวจสอบผลกระทบ...</p>
                )}

                {saveError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
              </div>
            </div>
          </div>

          {/* footer */}
          <div className="flex gap-3 border-t border-admin-border bg-white px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-xl border border-admin-border bg-white py-2.5 text-sm font-medium hover:bg-admin-surfaceMuted disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-primaryDark py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> กำลังบันทึก...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> บันทึก
                </>
              )}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
