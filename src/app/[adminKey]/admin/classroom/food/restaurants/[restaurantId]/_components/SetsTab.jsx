"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { idOf } from "./menuUi";

export default function SetsTab({ sets, menus, loading, onNew, onEdit, onDelete }) {
  const nameById = new Map(menus.map((m) => [String(m._id), m.name]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-admin-textMuted">ชุดอาหารที่รวมหลายเมนูของร้านนี้</p>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-1.5 rounded-xl border border-brand-primary/60 bg-white px-3 py-2 text-sm text-brand-primaryDark hover:bg-brand-primary/10"
        >
          <Plus className="h-4 w-4" /> เพิ่มชุดอาหาร
        </button>
      </div>

      {loading && sets.length === 0 && (
        <p className="text-sm text-admin-textMuted">กำลังโหลด...</p>
      )}
      {!loading && sets.length === 0 && (
        <p className="rounded-2xl border border-dashed border-admin-border bg-white py-10 text-center text-sm text-admin-textMuted">
          ยังไม่มีชุดอาหาร
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sets.map((s) => {
          const names = (s.menuIds || [])
            .map((id) => nameById.get(idOf(id)))
            .filter(Boolean);
          return (
            <div
              key={String(s._id)}
              className="flex items-start justify-between gap-3 rounded-2xl border border-admin-border bg-white p-4"
            >
              <div className="min-w-0">
                <div className="font-semibold text-admin-text">{s.name}</div>
                <div className="mt-1 text-xs text-admin-textMuted">
                  {names.length ? `เมนูในชุด: ${names.join(", ")}` : "ยังไม่ได้เลือกเมนูในชุด"}
                </div>
              </div>
              <div className="flex flex-shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(s)}
                  aria-label="แก้ไขชุดอาหาร"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-brand-primaryDark hover:bg-brand-primary/10"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(s._id)}
                  aria-label="ลบชุดอาหาร"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
