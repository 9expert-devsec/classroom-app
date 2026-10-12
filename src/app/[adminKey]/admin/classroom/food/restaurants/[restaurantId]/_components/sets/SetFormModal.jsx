"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { idOf, safeJson } from "../menuUi";
import MenuTransferList from "./MenuTransferList";
import { SET_NAME_MAX } from "./setUi";

function SectionTitle({ n, children }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primaryDark text-xs text-white">
        {n}
      </span>
      {children}
    </div>
  );
}

/** Create / edit one set. Mounted only while open. onSaved(setId) after save. */
export default function SetFormModal({ restaurantId, set, sets, menus, categories, onClose, onSaved }) {
  const isEdit = !!set;
  const [initial] = useState(() => ({
    name: set?.name || "",
    menuIds: (set?.menuIds || []).map(idOf).filter(Boolean),
  }));
  const [name, setName] = useState(initial.name);
  const [menuIds, setMenuIds] = useState(initial.menuIds);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);

  const menuById = useMemo(() => new Map(menus.map((m) => [String(m._id), m])), [menus]);
  const visibleCount = menuIds.filter((id) => menuById.has(id)).length;

  const clean = name.trim();
  // the sets API does not check names; keep them unique per shop here
  const duplicate = sets.some(
    (s) =>
      String(s._id) !== String(set?._id || "") &&
      String(s.name || "").trim().toLowerCase() === clean.toLowerCase(),
  );
  let nameError = "";
  if (!clean) nameError = "กรุณากรอกชื่อชุดเมนู";
  else if (clean.length > SET_NAME_MAX) nameError = `ชื่อชุดเมนูต้องไม่เกิน ${SET_NAME_MAX} ตัวอักษร`;
  else if (duplicate) nameError = "มีชุดเมนูชื่อนี้ในร้านแล้ว";
  const menuError = visibleCount === 0 ? "กรุณาเลือกเมนูอย่างน้อย 1 รายการ" : "";

  const dirty = name !== initial.name || menuIds.join() !== initial.menuIds.join();

  function requestClose() {
    if (saving) return;
    if (dirty && !confirm("ปิดหน้าต่างนี้? การเปลี่ยนแปลงที่ยังไม่ได้บันทึกจะหายไป")) return;
    onClose();
  }

  async function submit(e) {
    e.preventDefault();
    setTouched(true);
    if (nameError || menuError || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      // same payload as the old set form
      const res = await fetch(isEdit ? `/api/admin/food/sets/${set._id}` : "/api/admin/food/sets", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant: restaurantId, name: clean, menuIds }),
      });
      const out = await safeJson(res);
      if (!res.ok) {
        setError(out.error || "บันทึกชุดเมนูไม่สำเร็จ");
        return;
      }
      toast.success(isEdit ? "บันทึกชุดเมนูเรียบร้อย" : "สร้างชุดเมนูเรียบร้อย");
      onSaved(String(out.item?._id || set?._id || ""));
    } catch (err) {
      console.error(err);
      setError("บันทึกชุดเมนูไม่สำเร็จ");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const showName = touched || !!clean;

  return (
    <Dialog open onOpenChange={(o) => !o && requestClose()}>
      <DialogContent className="flex max-h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] max-w-5xl flex-col gap-0 rounded-2xl bg-white p-0">
        <div className="border-b border-admin-border px-5 py-4 pr-12">
          <DialogTitle className="text-lg">{isEdit ? "แก้ไขชุดเมนู" : "สร้างชุดเมนูใหม่"}</DialogTitle>
          <DialogDescription className="sr-only">ตั้งชื่อชุดเมนูและเลือกเมนูอาหารในชุด</DialogDescription>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <section>
              <SectionTitle n={1}>ข้อมูลชุดเมนู</SectionTitle>
              <label className="block">
                <span className="text-sm font-medium">
                  ชื่อชุดเมนู <span className="text-red-500">*</span>
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, SET_NAME_MAX))}
                  onBlur={() => setTouched(true)}
                  placeholder="เช่น Set A, Set B"
                  autoFocus
                  className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 ${
                    showName && nameError ? "border-red-400" : "border-admin-border"
                  }`}
                />
                <div className="mt-1 flex justify-between text-xs">
                  <span className="text-red-600">{showName ? nameError : ""}</span>
                  <span className="text-admin-textMuted">
                    {name.length}/{SET_NAME_MAX}
                  </span>
                </div>
              </label>
            </section>

            <section>
              <SectionTitle n={2}>เลือกเมนูอาหารในชุด</SectionTitle>
              <MenuTransferList
                menus={menus}
                categories={categories}
                value={menuIds}
                onChange={setMenuIds}
              />
              {touched && menuError && <p className="mt-2 text-xs text-red-600">{menuError}</p>}
            </section>

            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          </div>

          <div className="flex justify-end gap-3 border-t border-admin-border px-5 py-4">
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
              บันทึกชุดเมนู
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
