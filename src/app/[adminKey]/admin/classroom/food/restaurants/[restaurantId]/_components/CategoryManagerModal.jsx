"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, GripVertical, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import Toggle from "./Toggle";
import CategoryFormDialog from "./CategoryFormDialog";
import CategoryDeleteDialog from "./CategoryDeleteDialog";
import { menuCategoryIds, safeJson, sortCategories } from "./menuUi";

function move(list, from, to) {
  if (from === to || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

/** Mounted only while open. onChanged() refetches categories + menus. */
export default function CategoryManagerModal({
  restaurantId,
  categories,
  menus,
  onClose,
  onChanged,
}) {
  // staged drag order (ids); null = nothing staged
  const [staged, setStaged] = useState(null);
  const [dragId, setDragId] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [form, setForm] = useState(null); // { category } | { category: null }
  const [deleting, setDeleting] = useState(null);

  const sorted = useMemo(() => sortCategories(categories), [categories]);
  const byId = useMemo(
    () => new Map(sorted.map((c) => [String(c._id), c])),
    [sorted],
  );

  // staged ids first (skipping deleted ones), then anything added since
  const rows = useMemo(() => {
    if (!staged) return sorted;
    const seen = new Set();
    const out = [];
    for (const id of staged) {
      const c = byId.get(id);
      if (c) {
        out.push(c);
        seen.add(id);
      }
    }
    for (const c of sorted) if (!seen.has(String(c._id))) out.push(c);
    return out;
  }, [staged, sorted, byId]);

  const orderDirty =
    !!staged &&
    rows.map((c) => String(c._id)).join() !== sorted.map((c) => String(c._id)).join();

  const menuCount = useMemo(() => {
    const m = new Map();
    for (const menu of menus) {
      for (const id of menuCategoryIds(menu)) m.set(id, (m.get(id) || 0) + 1);
    }
    return m;
  }, [menus]);

  function stageMove(from, to) {
    setStaged(move(rows.map((c) => String(c._id)), from, to));
  }

  function requestClose() {
    if (savingOrder) return;
    if (orderDirty && !confirm("ยังไม่ได้บันทึกลำดับ ต้องการปิดและยกเลิกการจัดลำดับหรือไม่?")) {
      return;
    }
    onClose();
  }

  async function saveOrder() {
    if (!orderDirty || savingOrder) return;
    setSavingOrder(true);
    try {
      const res = await fetch("/api/admin/food/categories/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, ids: rows.map((c) => String(c._id)) }),
      });
      const out = await safeJson(res);
      if (!res.ok) {
        toast.error(out.error || "บันทึกลำดับไม่สำเร็จ");
        return;
      }
      await onChanged();
      setStaged(null);
      toast.success("บันทึกลำดับหมวดหมู่เรียบร้อย");
    } catch (err) {
      console.error(err);
      toast.error("บันทึกลำดับไม่สำเร็จ");
    } finally {
      setSavingOrder(false);
    }
  }

  async function toggleActive(c, next) {
    const id = String(c._id);
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/food/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const out = await safeJson(res);
      if (!res.ok) {
        toast.error(out.error || "เปลี่ยนสถานะไม่สำเร็จ");
        return;
      }
      await onChanged();
    } catch (err) {
      console.error(err);
      toast.error("เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setBusyId("");
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && requestClose()}>
        <DialogContent className="flex max-h-[calc(100svh-2rem)] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-4 rounded-2xl bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="text-lg">จัดการหมวดหมู่เมนู</DialogTitle>
              <DialogDescription className="mt-1 text-admin-textMuted">
                เพิ่ม แก้ไข จัดลำดับ หรือปิดใช้งานหมวดหมู่เมนู
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => setForm({ category: null })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primaryDark px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              <Plus className="h-4 w-4" /> เพิ่มหมวดหมู่
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-admin-border">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="sticky top-0 bg-admin-surfaceMuted text-left text-xs text-admin-textMuted">
                <tr>
                  <th className="w-16 px-2 py-2" aria-label="ลากเพื่อจัดลำดับ" />
                  <th className="px-2 py-2 font-medium">ลำดับ</th>
                  <th className="px-2 py-2 font-medium">ชื่อหมวดหมู่</th>
                  <th className="px-2 py-2 text-center font-medium">จำนวนเมนู</th>
                  <th className="px-2 py-2 font-medium">สถานะ</th>
                  <th className="px-2 py-2 text-right font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => {
                  const id = String(c._id);
                  const active = c.isActive !== false;
                  return (
                    <tr
                      key={id}
                      draggable={!savingOrder}
                      onDragStart={(e) => {
                        setDragId(id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        if (!dragId || dragId === id) return;
                        e.preventDefault();
                        const from = rows.findIndex((r) => String(r._id) === dragId);
                        if (from >= 0) stageMove(from, i);
                      }}
                      onDrop={(e) => e.preventDefault()}
                      onDragEnd={() => setDragId("")}
                      className={`border-t border-admin-border/60 ${
                        dragId === id ? "bg-brand-primary/10" : "bg-white"
                      }`}
                    >
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-0.5 text-admin-textMuted">
                          <GripVertical className="h-4 w-4 cursor-grab" aria-hidden />
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => stageMove(i, i - 1)}
                              disabled={i === 0 || savingOrder}
                              aria-label="เลื่อนขึ้น"
                              className="rounded hover:bg-admin-surfaceMuted disabled:opacity-30"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => stageMove(i, i + 1)}
                              disabled={i === rows.length - 1 || savingOrder}
                              aria-label="เลื่อนลง"
                              className="rounded hover:bg-admin-surfaceMuted disabled:opacity-30"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-admin-border text-xs">
                          {i + 1}
                        </span>
                      </td>
                      <td className={`px-2 py-2 ${active ? "" : "text-admin-textMuted"}`}>{c.name}</td>
                      <td className="px-2 py-2 text-center">{menuCount.get(id) || 0}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <Toggle
                            checked={active}
                            disabled={busyId === id}
                            onChange={(next) => toggleActive(c, next)}
                            label={active ? "ปิดใช้งานหมวดหมู่" : "เปิดใช้งานหมวดหมู่"}
                          />
                          <span className="whitespace-nowrap text-xs">
                            {active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setForm({ category: c })}
                          aria-label={`แก้ไข ${c.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-brand-primaryDark hover:bg-brand-primary/10"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(c)}
                          aria-label={`ลบ ${c.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-admin-textMuted">
                      ร้านนี้ยังไม่มีหมวดหมู่ — กด &quot;+ เพิ่มหมวดหมู่&quot; เพื่อเริ่มต้น
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={requestClose}
              disabled={savingOrder}
              className="rounded-xl border border-admin-border bg-white px-5 py-2 text-sm font-medium hover:bg-admin-surfaceMuted disabled:opacity-50"
            >
              ปิด
            </button>
            {orderDirty && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-700">มีการเปลี่ยนลำดับที่ยังไม่ได้บันทึก</span>
                <button
                  type="button"
                  onClick={() => setStaged(null)}
                  disabled={savingOrder}
                  className="rounded-xl border border-admin-border bg-white px-4 py-2 text-sm hover:bg-admin-surfaceMuted disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={saveOrder}
                  disabled={savingOrder}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primaryDark px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
                >
                  {savingOrder && <Loader2 className="h-4 w-4 animate-spin" />}
                  บันทึกลำดับ
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {form && (
        <CategoryFormDialog
          restaurantId={restaurantId}
          category={form.category}
          categories={categories}
          defaultOrder={categories.length + 1}
          onClose={() => setForm(null)}
          onSaved={async () => {
            const wasEdit = !!form.category;
            setForm(null);
            await onChanged();
            toast.success(wasEdit ? "บันทึกหมวดหมู่เรียบร้อย" : "เพิ่มหมวดหมู่เรียบร้อย");
          }}
        />
      )}

      {deleting && (
        <CategoryDeleteDialog
          category={deleting}
          menuCount={menuCount.get(String(deleting._id)) || 0}
          onClose={() => setDeleting(null)}
          onDeleted={async () => {
            setDeleting(null);
            await onChanged();
            toast.success("ลบหมวดหมู่เรียบร้อย");
          }}
        />
      )}
    </>
  );
}
