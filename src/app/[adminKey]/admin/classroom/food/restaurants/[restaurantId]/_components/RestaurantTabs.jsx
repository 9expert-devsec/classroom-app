"use client";

import { CupSoda, LayoutGrid, ListChecks, PackagePlus, UtensilsCrossed } from "lucide-react";

const TAB_DEFS = [
  { key: "menus", label: "เมนูอาหาร", icon: UtensilsCrossed },
  { key: "sets", label: "ชุดอาหาร", icon: LayoutGrid },
  { key: "addons", label: "Add-on", icon: PackagePlus },
  { key: "drinks", label: "Drink", icon: CupSoda },
  // OS-2: FoodOptionSet
  { key: "optionsets", label: "ชุดตัวเลือก", icon: ListChecks },
];

export default function RestaurantTabs({ tab, counts, onChange }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div role="tablist" className="flex min-w-max gap-1 border-b border-admin-border">
        {TAB_DEFS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(key)}
              className={[
                "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition",
                active
                  ? "border-brand-primaryDark font-semibold text-brand-primaryDark"
                  : "border-transparent text-admin-textMuted hover:text-admin-text",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              {label} ({counts[key] ?? 0})
            </button>
          );
        })}
      </div>
    </div>
  );
}
