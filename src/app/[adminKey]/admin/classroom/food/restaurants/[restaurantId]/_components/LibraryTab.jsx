"use client";

import Image from "next/image";
import { ImageOff, Pencil, Plus, Search, Trash2 } from "lucide-react";

/** Add-on / Drink library of the shop (same shape, same actions) */
export default function LibraryTab({
  label,
  description,
  items,
  q,
  setQ,
  loading,
  onNew,
  onEdit,
  onDelete,
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-admin-textMuted">{description}</p>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-1.5 rounded-xl border border-brand-primary/60 bg-white px-3 py-2 text-sm text-brand-primaryDark hover:bg-brand-primary/10"
        >
          <Plus className="h-4 w-4" /> เพิ่ม {label}
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-textMuted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`ค้นหา ${label}...`}
          className="w-full rounded-xl border border-admin-border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        />
      </div>

      {loading && items.length === 0 && (
        <p className="text-sm text-admin-textMuted">กำลังโหลด...</p>
      )}
      {!loading && items.length === 0 && (
        <p className="rounded-2xl border border-dashed border-admin-border bg-white py-10 text-center text-sm text-admin-textMuted">
          ยังไม่มี {label}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((a) => (
          <div
            key={String(a._id)}
            className={`flex items-center gap-3 rounded-2xl border border-admin-border bg-white p-3 ${
              a.isActive === false ? "opacity-60" : ""
            }`}
          >
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-admin-surfaceMuted">
              {a.imageUrl ? (
                <Image src={a.imageUrl} alt={a.name || label} fill sizes="48px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-admin-textMuted">
                  <ImageOff className="h-4 w-4" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-admin-text">{a.name}</div>
              <div className="text-[11px] text-admin-textMuted">
                {a.isActive === false ? "ปิดใช้งาน" : "เปิดใช้งาน"}
              </div>
            </div>
            <div className="flex flex-shrink-0 gap-1">
              <button
                type="button"
                onClick={() => onEdit(a)}
                aria-label={`แก้ไข ${label}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-brand-primaryDark hover:bg-brand-primary/10"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(a)}
                aria-label={`ลบ ${label}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
