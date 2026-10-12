"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import Toggle from "./Toggle";
import { isRecommendedCategory, safeJson } from "./menuUi";

const NAME_MAX = 50;

const inputCls =
  "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-admin-text outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";

/**
 * Add / edit one category. Mounted only while open (fresh form each time).
 * The order field is 1-based on screen; stored sortOrder is 0-based.
 */
export default function CategoryFormDialog({
  restaurantId,
  category,
  categories,
  defaultOrder,
  onClose,
  onSaved,
}) {
  const isEdit = !!category;
  const [name, setName] = useState(category?.name || "");
  const [order, setOrder] = useState(
    String(isEdit ? (category.sortOrder ?? 0) + 1 : defaultOrder),
  );
  const [active, setActive] = useState(category ? category.isActive !== false : true);
  // categories saved before the flag existed start from the name rule
  const [highlight, setHighlight] = useState(() => isRecommendedCategory(category));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  const clean = name.trim();
  const orderNum = Number(order);
  const duplicate = categories.some(
    (c) =>
      String(c._id) !== String(category?._id || "") &&
      String(c.name || "").trim().toLowerCase() === clean.toLowerCase(),
  );

  let nameError = "";
  if (!clean) nameError = "กรุณากรอกชื่อหมวดหมู่";
  else if (clean.length > NAME_MAX) nameError = `ชื่อหมวดหมู่ต้องไม่เกิน ${NAME_MAX} ตัวอักษร`;
  else if (duplicate) nameError = "มีหมวดหมู่ชื่อนี้ในร้านแล้ว";

  const orderError =
    order.trim() === "" || !Number.isInteger(orderNum) || orderNum < 1
      ? "ลำดับต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป"
      : "";

  const showNameError = touched || !!clean;
  const valid = !nameError && !orderError;

  async function submit(e) {
    e.preventDefault();
    setTouched(true);
    if (!valid || saving) return;
    setSaving(true);
    setServerError("");
    try {
      const body = { name: clean, sortOrder: orderNum - 1, isActive: active, highlight };
      const res = await fetch(
        isEdit
          ? `/api/admin/food/categories/${category._id}`
          : "/api/admin/food/categories",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isEdit ? body : { ...body, restaurantId }),
        },
      );
      const out = await safeJson(res);
      if (!res.ok) {
        setServerError(out.error || "บันทึกหมวดหมู่ไม่สำเร็จ");
        return;
      }
      onSaved(out.item);
    } catch (err) {
      console.error(err);
      setServerError("บันทึกหมวดหมู่ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-md rounded-2xl bg-white">
        <div>
          <DialogTitle className="text-lg">
            {isEdit ? "แก้ไขหมวดหมู่เมนู" : "เพิ่มหมวดหมู่เมนู"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-admin-textMuted">
            {isEdit ? "กรอกข้อมูลหมวดหมู่ที่ต้องการแก้ไข" : "กรอกข้อมูลหมวดหมู่ที่ต้องการเพิ่ม"}
          </DialogDescription>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">
              ชื่อหมวดหมู่ <span className="text-red-500">*</span>
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
              onBlur={() => setTouched(true)}
              placeholder="เช่น Grilled / Fried / Set"
              autoFocus
              className={`${inputCls} ${showNameError && nameError ? "border-red-400" : "border-admin-border"}`}
            />
            <div className="mt-1 flex justify-between gap-2 text-xs">
              <span className="text-red-600">{showNameError ? nameError : ""}</span>
              <span className="text-admin-textMuted">
                {name.length}/{NAME_MAX}
              </span>
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-medium">ลำดับการแสดงผล</span>
            <input
              type="number"
              min="1"
              step="1"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              className={`${inputCls} max-w-[10rem] ${orderError ? "border-red-400" : "border-admin-border"}`}
            />
            <p className={`mt-1 text-xs ${orderError ? "text-red-600" : "text-admin-textMuted"}`}>
              {orderError || "ตัวเลขน้อยจะแสดงก่อน"}
            </p>
          </label>

          <fieldset>
            <legend className="text-sm font-medium">สถานะ</legend>
            <div className="mt-1 flex gap-6 text-sm">
              {[
                [true, "เปิดใช้งาน"],
                [false, "ปิดใช้งาน"],
              ].map(([v, label]) => (
                <label key={label} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="category-active"
                    checked={active === v}
                    onChange={() => setActive(v)}
                    className="accent-[#0099CC]"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-admin-textMuted">
              หากปิดใช้งาน หมวดหมู่จะไม่แสดงในหน้าร้านและฟอร์มเลือกหมวดหมู่
            </p>
          </fieldset>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-admin-border p-3">
            <span className="text-sm font-medium">แสดงเป็นหมวดแนะนำ (สีส้ม)</span>
            <Toggle
              checked={highlight}
              onChange={setHighlight}
              label="แสดงเป็นหมวดแนะนำ (สีส้ม)"
            />
          </div>

          {serverError && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{serverError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-xl border border-admin-border bg-white py-2.5 text-sm font-medium hover:bg-admin-surfaceMuted disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={!valid || saving}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-primaryDark py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "บันทึกการเปลี่ยนแปลง" : "บันทึกหมวดหมู่"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
