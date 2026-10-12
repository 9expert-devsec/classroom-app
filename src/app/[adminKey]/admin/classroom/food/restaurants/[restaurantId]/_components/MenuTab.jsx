"use client";

import { useMemo, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import MenuToolbar from "./MenuToolbar";
import MenuCard from "./MenuCard";
import MenuTable from "./MenuTable";
import MenuPagination from "./MenuPagination";
import { menuCategoryIds, sortCategories } from "./menuUi";

const collator = new Intl.Collator("th");

export default function MenuTab({
  menus,
  categories,
  loading,
  couponEnabled,
  params,
  setParams,
  onAdd,
  onEdit,
  onDelete,
  onToggleActive,
  onManageCategories,
}) {
  const [searchResetKey, setSearchResetKey] = useState(0);

  const ordered = useMemo(() => sortCategories(categories), [categories]);
  const orderedIds = useMemo(() => ordered.map((c) => String(c._id)), [ordered]);
  const categoryById = useMemo(
    () => new Map(ordered.map((c) => [String(c._id), c])),
    [ordered],
  );

  // a stale ?cat= (deleted category) falls back to "all"
  const cat =
    params.cat === "__none__" || categoryById.has(params.cat) ? params.cat : "";

  const filtered = useMemo(() => {
    const kw = params.q.toLowerCase();
    const list = menus.filter((m) => {
      const ids = menuCategoryIds(m);
      if (cat === "__none__" && ids.some((id) => categoryById.has(id))) return false;
      if (cat && cat !== "__none__" && !ids.includes(cat)) return false;
      if (params.status === "active" && m.isActive === false) return false;
      if (params.status === "inactive" && m.isActive !== false) return false;
      if (kw) {
        const hay = [m.name, ...ids.map((id) => categoryById.get(id)?.name)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });

    const byName = (a, b) => collator.compare(a.name || "", b.name || "");
    const cmp = {
      order: (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || byName(a, b),
      name: byName,
      // no price goes last
      price: (a, b) =>
        (a.price ?? Infinity) - (b.price ?? Infinity) || byName(a, b),
    }[params.sort];
    return list.sort(cmp);
  }, [menus, cat, params.q, params.status, params.sort, categoryById]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / params.size));
  const page = Math.min(params.page, totalPages);
  const pageItems = filtered.slice((page - 1) * params.size, page * params.size);
  const hasFilters = !!(params.q || cat || params.status);

  function clearFilters() {
    setParams({ q: "", cat: "", status: "" });
    setSearchResetKey((k) => k + 1);
  }

  const shared = {
    categoryById,
    orderedCategoryIds: orderedIds,
    onEdit,
    onDelete,
    onToggleActive,
  };

  return (
    <div className="space-y-4">
      <MenuToolbar
        params={{ ...params, cat }}
        setParams={setParams}
        categories={ordered}
        searchResetKey={searchResetKey}
        onManageCategories={onManageCategories}
      />

      {loading && menus.length === 0 ? (
        <p className="py-10 text-center text-sm text-admin-textMuted">กำลังโหลดเมนู...</p>
      ) : menus.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-admin-border bg-white py-12 text-center">
          <UtensilsCrossed className="h-8 w-8 text-admin-textMuted" />
          <div className="text-sm text-admin-textMuted">ร้านนี้ยังไม่มีเมนู</div>
          <button
            type="button"
            onClick={onAdd}
            className="rounded-xl bg-brand-primaryDark px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            + เพิ่มเมนู
          </button>
        </div>
      ) : total === 0 ? (
        <div className="space-y-2 rounded-2xl border border-dashed border-admin-border bg-white py-12 text-center text-sm text-admin-textMuted">
          <div>ไม่พบเมนูตามคำค้นหาหรือตัวกรองที่เลือก</div>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-brand-primaryDark hover:underline"
            >
              ล้างคำค้นหาและตัวกรอง
            </button>
          )}
        </div>
      ) : params.view === "list" ? (
        <MenuTable menus={pageItems} {...shared} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map((m) => (
            <MenuCard key={String(m._id)} menu={m} couponEnabled={couponEnabled} {...shared} />
          ))}
        </div>
      )}

      {total > 0 && (
        <MenuPagination
          page={page}
          totalPages={totalPages}
          size={params.size}
          shown={pageItems.length}
          total={total}
          onPage={(p) => setParams({ page: p > 1 ? p : "" })}
          onSize={(n) => setParams({ size: n === 12 ? "" : n })}
        />
      )}
    </div>
  );
}
