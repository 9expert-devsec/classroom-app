"use client";

import Toggle from "./Toggle";
import { CategoryChips, MenuActions, MenuImage } from "./MenuBits";
import { formatPrice, optionSummary } from "./menuUi";

export default function MenuTable({
  menus,
  categoryById,
  orderedCategoryIds,
  onEdit,
  onDelete,
  onToggleActive,
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-admin-border bg-white">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-admin-surfaceMuted text-left text-xs text-admin-textMuted">
          <tr>
            <th className="px-3 py-2 font-medium">เมนู</th>
            <th className="px-3 py-2 font-medium">หมวดหมู่</th>
            <th className="px-3 py-2 text-right font-medium">ราคา</th>
            <th className="px-3 py-2 font-medium">ตัวเลือก</th>
            <th className="px-3 py-2 text-center font-medium">ลำดับ</th>
            <th className="px-3 py-2 font-medium">สถานะ</th>
            <th className="px-3 py-2 text-right font-medium">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {menus.map((m) => {
            const active = m.isActive !== false;
            return (
              <tr
                key={String(m._id)}
                onClick={() => onEdit(m)}
                className={`cursor-pointer border-t border-admin-border/60 hover:bg-admin-surfaceMuted/60 ${
                  active ? "" : "text-admin-textMuted"
                }`}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <MenuImage
                      menu={m}
                      sizes="40px"
                      className={`h-10 w-10 flex-shrink-0 ${active ? "" : "opacity-50 grayscale"}`}
                    />
                    <span className="font-medium">{m.name}</span>
                  </div>
                </td>
                <td className="max-w-[240px] px-3 py-2">
                  <CategoryChips
                    menu={m}
                    categoryById={categoryById}
                    orderedCategoryIds={orderedCategoryIds}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {formatPrice(m.price) || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-admin-textMuted">
                  {optionSummary(m)}
                </td>
                <td className="px-3 py-2 text-center">{m.sortOrder ?? 0}</td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <Toggle
                      checked={active}
                      onChange={(next) => onToggleActive(m, next)}
                      label={active ? "ปิดใช้งานเมนู" : "เปิดใช้งานเมนู"}
                    />
                    <span className="text-xs">{active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                  <MenuActions menu={m} onEdit={onEdit} onDelete={onDelete} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
