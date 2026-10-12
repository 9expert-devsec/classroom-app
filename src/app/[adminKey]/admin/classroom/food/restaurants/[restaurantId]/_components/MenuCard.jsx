"use client";

import Toggle from "./Toggle";
import { CategoryChips, MenuActions, MenuImage } from "./MenuBits";
import { formatPrice, optionSummary } from "./menuUi";

export default function MenuCard({
  menu,
  categoryById,
  orderedCategoryIds,
  couponEnabled,
  onEdit,
  onDelete,
  onToggleActive,
}) {
  const active = menu.isActive !== false;
  const hasPrice = menu.price !== null && menu.price !== undefined;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(menu)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(menu);
        }
      }}
      className={[
        "relative flex min-w-0 cursor-pointer gap-3 rounded-2xl border border-admin-border bg-white p-3 text-left transition hover:border-brand-primary hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50",
        active ? "" : "bg-slate-50",
      ].join(" ")}
    >
      <MenuImage
        menu={menu}
        sizes="96px"
        className={`aspect-square w-24 flex-shrink-0 ${active ? "" : "opacity-50 grayscale"}`}
      />

      <div className={`flex min-w-0 flex-1 flex-col ${active ? "" : "opacity-60"}`}>
        <div className="pr-16 text-sm font-semibold leading-snug text-admin-text line-clamp-2">
          {menu.name}
        </div>
        <div className="mt-0.5 text-sm text-admin-text">
          {hasPrice ? (
            formatPrice(menu.price)
          ) : couponEnabled ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              ยังไม่ใส่ราคา
            </span>
          ) : (
            <span className="text-xs text-admin-textMuted">ไม่กำหนดราคา</span>
          )}
        </div>
        <div className="mt-1.5">
          <CategoryChips
            menu={menu}
            categoryById={categoryById}
            orderedCategoryIds={orderedCategoryIds}
          />
        </div>
        <div className="mt-auto truncate pr-8 pt-1.5 text-[11px] text-admin-textMuted">
          {optionSummary(menu)}
        </div>
      </div>

      {/* toggle + ⋮ (top-right) */}
      <div
        className="absolute right-2 top-2 flex items-center gap-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <Toggle
          checked={active}
          onChange={(next) => onToggleActive(menu, next)}
          label={active ? "ปิดใช้งานเมนู" : "เปิดใช้งานเมนู"}
        />
        <MenuActions menu={menu} onEdit={onEdit} onDelete={onDelete} />
      </div>

      {/* display order (bottom-right) */}
      <span
        className="absolute bottom-2 right-2 inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-admin-surfaceMuted px-1.5 text-[11px] font-semibold text-admin-textMuted"
        title="ลำดับการแสดงผล"
      >
        {menu.sortOrder ?? 0}
      </span>
    </div>
  );
}
