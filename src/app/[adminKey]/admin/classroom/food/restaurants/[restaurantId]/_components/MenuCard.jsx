"use client";

import Toggle from "./Toggle";
import { CategoryChips, MenuActions, MenuImage, StatusLabel } from "./MenuBits";
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
    <div className="flex h-full min-w-0 flex-col rounded-2xl border border-admin-border bg-white transition hover:border-brand-primary hover:shadow-sm">
      {/* body: opens the edit form */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onEdit(menu)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEdit(menu);
          }
        }}
        className={`flex flex-1 cursor-pointer gap-3 rounded-t-2xl p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 ${
          active ? "" : "opacity-50 grayscale"
        }`}
      >
        <MenuImage menu={menu} sizes="112px" className="aspect-square w-28 flex-shrink-0 self-start" />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div
            title={menu.name}
            className="line-clamp-2 break-words text-sm font-semibold leading-snug text-admin-text"
          >
            {menu.name}
          </div>
          <div className="text-sm text-admin-text">
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
          <CategoryChips
            menu={menu}
            categoryById={categoryById}
            orderedCategoryIds={orderedCategoryIds}
          />
          <div className="text-[11px] text-admin-textMuted">{optionSummary(menu)}</div>
        </div>
      </div>

      {/* footer: full contrast even when the menu is off */}
      <div className="flex items-center justify-between gap-2 border-t border-admin-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <StatusLabel active={active} />
          <span className="whitespace-nowrap text-[11px] text-admin-textMuted">
            ลำดับ {menu.sortOrder ?? 0}
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <Toggle
            checked={active}
            onChange={(next) => onToggleActive(menu, next)}
            label={active ? "ปิดใช้งานเมนู" : "เปิดใช้งานเมนู"}
          />
          <MenuActions menu={menu} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>
    </div>
  );
}
