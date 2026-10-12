"use client";

import Image from "next/image";
import { ImageOff, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isRecommendedCategory, menuCategoryIds } from "./menuUi";

export function MenuImage({ menu, sizes, className = "" }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-admin-surfaceMuted ${className}`}>
      {menu.imageUrl ? (
        <Image
          src={menu.imageUrl}
          alt={menu.name || "menu"}
          fill
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-admin-textMuted">
          <ImageOff className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

/** category chips in category order; "แนะนำ" orange, disabled grey */
export function CategoryChips({ menu, categoryById, orderedCategoryIds }) {
  const mine = new Set(menuCategoryIds(menu));
  const chips = orderedCategoryIds
    .filter((id) => mine.has(id))
    .map((id) => categoryById.get(id))
    .filter(Boolean);

  if (chips.length === 0) {
    return <span className="text-[11px] text-admin-textMuted">ไม่มีหมวดหมู่</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => {
        const off = c.isActive === false;
        const cls = off
          ? "bg-slate-100 text-slate-500 line-through"
          : isRecommendedCategory(c)
            ? "bg-orange-100 text-orange-700"
            : "bg-brand-primary/15 text-brand-primaryDark";
        return (
          <span
            key={String(c._id)}
            title={off ? "หมวดหมู่นี้ปิดใช้งานอยู่" : undefined}
            className={`inline-flex max-w-full truncate rounded-md px-2 py-0.5 text-[11px] font-medium ${cls}`}
          >
            {c.name}
          </span>
        );
      })}
    </div>
  );
}

/** ⋮ menu with the actions that exist today: edit, delete */
export function MenuActions({ menu, onEdit, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="เมนูการจัดการ"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-admin-textMuted hover:bg-admin-surfaceMuted"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        onClick={(e) => e.stopPropagation()}
        className="w-32 rounded-xl bg-white py-1 text-xs shadow-lg ring-1 ring-black/5"
      >
        <DropdownMenuItem onSelect={() => onEdit(menu)}>แก้ไข</DropdownMenuItem>
        <DropdownMenuItem
          className="text-red-600 focus:text-red-600"
          onSelect={() => onDelete(menu)}
        >
          ลบ
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
