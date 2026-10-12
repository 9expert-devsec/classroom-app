"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { DESCRIPTION_MAX, imageWidthOf, MIN_IMAGE_W, NAME_MAX } from "./wizardModel";

const inputCls =
  "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-admin-text outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";

function Field({ label, required, error, hint, counter, children }) {
  return (
    <div>
      <span className="text-sm font-medium text-admin-text">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      <div className="mt-1 flex justify-between gap-2 text-xs">
        <span className={error ? "text-red-600" : "text-admin-textMuted"}>{error || hint || ""}</span>
        {counter && <span className="flex-shrink-0 text-admin-textMuted">{counter}</span>}
      </div>
    </div>
  );
}

function CategoryPicker({ value, onChange, activeCategories, hiddenCount, error }) {
  const byId = new Map(activeCategories.map((c) => [String(c._id), c]));
  const picked = value.filter((id) => byId.has(id));
  const left = activeCategories.filter((c) => !value.includes(String(c._id)));

  return (
    <Field
      label="หมวดหมู่"
      required
      error={error}
      hint={
        hiddenCount > 0
          ? `เมนูนี้อยู่ในหมวดที่ปิดใช้งานอีก ${hiddenCount} หมวด (ไม่แสดงที่นี่ และยังคงไว้เมื่อบันทึก)`
          : "เลือกได้หลายหมวด — เมนูจะแสดงในทุกหมวดที่เลือก"
      }
    >
      <div
        className={`mt-1 flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border bg-white px-2 py-1.5 ${
          error ? "border-red-400" : "border-admin-border"
        }`}
      >
        {picked.map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-md bg-brand-primary/15 px-2 py-0.5 text-xs text-brand-primaryDark"
          >
            {byId.get(id).name}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== id))}
              aria-label={`นำ ${byId.get(id).name} ออก`}
              className="rounded hover:bg-brand-primary/25"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {left.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && onChange([...value, e.target.value])}
            aria-label="เพิ่มหมวดหมู่"
            className="min-w-[8rem] flex-1 cursor-pointer bg-transparent py-0.5 text-sm text-admin-textMuted outline-none"
          >
            <option value="">{picked.length ? "+ เพิ่มหมวดหมู่" : "เลือกหมวดหมู่..."}</option>
            {left.map((c) => (
              <option key={String(c._id)} value={String(c._id)}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </Field>
  );
}

function ImageField({ imageUrl, name, onChange, uploadImage }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [smallW, setSmallW] = useState(0);
  const [error, setError] = useState("");

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("รองรับเฉพาะไฟล์รูปภาพ");
      return;
    }
    setError("");
    // small images only get a warning (mobile menu shows them full width)
    const w = await imageWidthOf(file);
    setSmallW(w > 0 && w < MIN_IMAGE_W ? w : 0);
    setUploading(true);
    try {
      const out = await uploadImage(file);
      onChange(out.url);
    } catch (err) {
      console.error(err);
      setError("อัปโหลดรูปเมนูไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <span className="text-sm font-medium text-admin-text">รูปเมนู (ไม่บังคับ)</span>
      <div className="relative mt-1 aspect-square w-full max-w-[260px] overflow-hidden rounded-2xl border border-dashed border-admin-border bg-admin-surfaceMuted">
        {imageUrl ? (
          <>
            <Image src={imageUrl} alt={name || "menu"} fill sizes="260px" className="object-cover" />
            <button
              type="button"
              onClick={() => {
                onChange("");
                setSmallW(0);
              }}
              aria-label="ลบรูป"
              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-admin-text shadow hover:bg-white"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-admin-textMuted hover:text-admin-text"
          >
            <ImagePlus className="h-7 w-7" />
            อัปโหลดรูปภาพ
          </button>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-6 w-6 animate-spin text-brand-primaryDark" />
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      {imageUrl && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="mt-2 w-full max-w-[260px] rounded-xl border border-brand-primary/60 bg-white py-1.5 text-sm text-brand-primaryDark hover:bg-brand-primary/10 disabled:opacity-50"
        >
          เปลี่ยนรูปภาพ
        </button>
      )}
      <p className="mt-1 text-xs text-admin-textMuted">
        รองรับไฟล์รูปภาพ (JPG, PNG, WebP) · แนะนำความกว้างอย่างน้อย {MIN_IMAGE_W}px
      </p>
      {smallW > 0 && (
        <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700">
          ภาพมีขนาดเล็ก อาจไม่คมชัดบนมือถือ (ภาพนี้กว้าง {smallW}px)
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      <label className="mt-3 block text-xs text-admin-textMuted">
        หรือวางลิงก์รูป
        <input
          value={imageUrl}
          onChange={(e) => {
            onChange(e.target.value);
            setSmallW(0);
          }}
          placeholder="https://..."
          className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1 text-xs text-admin-text outline-none focus:border-brand-primary"
        />
      </label>
    </div>
  );
}

export default function StepInfo({
  form,
  set,
  errors,
  showErrors,
  activeCategories,
  hiddenCategoryCount,
  uploadImage,
}) {
  const err = (k) => (showErrors[k] ? errors[k] : "");

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-4">
        <Field
          label="ชื่อเมนู"
          required
          error={err("name")}
          counter={`${form.name.length}/${NAME_MAX}`}
        >
          <input
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            maxLength={NAME_MAX}
            placeholder="เช่น เต้าหู้ทอด ซอสญี่ปุ่น"
            className={`${inputCls} ${err("name") ? "border-red-400" : "border-admin-border"}`}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="ราคา (บาท)" required error={err("price")}>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => set({ price: e.target.value })}
              className={`${inputCls} ${err("price") ? "border-red-400" : "border-admin-border"}`}
            />
          </Field>
          <Field label="ลำดับการแสดงผล" error={err("sortOrder")} hint="ตัวเลขน้อยจะแสดงก่อน">
            <input
              type="number"
              step="1"
              value={form.sortOrder}
              onChange={(e) => set({ sortOrder: e.target.value })}
              className={`${inputCls} ${err("sortOrder") ? "border-red-400" : "border-admin-border"}`}
            />
          </Field>
        </div>

        {/* a shop with no (active) categories has no category field */}
        {activeCategories.length > 0 && (
          <CategoryPicker
            value={form.categoryIds}
            onChange={(categoryIds) => set({ categoryIds })}
            activeCategories={activeCategories}
            hiddenCount={hiddenCategoryCount}
            error={err("categoryIds")}
          />
        )}

        <Field
          label="คำอธิบาย (ไม่บังคับ)"
          error={err("description")}
          counter={`${form.description.length}/${DESCRIPTION_MAX}`}
        >
          <textarea
            value={form.description}
            onChange={(e) => set({ description: e.target.value.slice(0, DESCRIPTION_MAX) })}
            rows={4}
            placeholder="รายละเอียดสั้น ๆ ที่ผู้เรียนจะเห็นตอนสั่ง"
            className={`${inputCls} resize-y border-admin-border`}
          />
        </Field>
      </div>

      <ImageField
        imageUrl={form.imageUrl}
        name={form.name}
        onChange={(imageUrl) => set({ imageUrl })}
        uploadImage={uploadImage}
      />
    </div>
  );
}
