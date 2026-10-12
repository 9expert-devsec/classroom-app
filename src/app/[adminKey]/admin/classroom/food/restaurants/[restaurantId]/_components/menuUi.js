// shared helpers for the restaurant detail page (client-side only)
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const TABS = ["menus", "sets", "addons", "drinks"];
export const PAGE_SIZES = [12, 24, 48];
export const SORTS = ["order", "name", "price"];
export const VIEWS = ["grid", "list"];
export const STATUSES = ["active", "inactive"];

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/**
 * Tab / filters / sort / view / page live in the URL.
 * Values are read straight from the search params (never mirrored into state).
 */
export function useListParams() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const size = Number(sp.get("size"));
  const params = {
    tab: pick(sp.get("tab"), TABS, "menus"),
    q: sp.get("q") || "",
    cat: sp.get("cat") || "",
    status: pick(sp.get("status"), STATUSES, ""),
    sort: pick(sp.get("sort"), SORTS, "order"),
    view: pick(sp.get("view"), VIEWS, "grid"),
    size: PAGE_SIZES.includes(size) ? size : PAGE_SIZES[0],
    page: Math.max(1, Math.floor(Number(sp.get("page")) || 1)),
  };

  // patch: { key: value | "" | null }; empty removes the key.
  // Any change other than the page itself goes back to page 1.
  const setParams = useCallback(
    (patch) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === "" || v === null || v === undefined) next.delete(k);
        else next.set(k, String(v));
      }
      if (!("page" in patch)) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, sp],
  );

  return [params, setParams];
}

export function idOf(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  return String(x._id || x);
}

export function menuCategoryIds(m) {
  return [...new Set((m?.categoryIds || []).map(idOf).filter(Boolean))];
}

export function sortCategories(categories) {
  return [...(categories || [])].sort(
    (a, b) =>
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
      String(a.createdAt || "").localeCompare(String(b.createdAt || "")),
  );
}

// orange "แนะนำ" chip: the category's highlight flag when it has been set,
// otherwise the old name rule (older categories never had the flag)
export function isNamedAsRecommended(name) {
  return /แนะนำ|recommend/i.test(String(name || ""));
}

export function isRecommendedCategory(c) {
  if (typeof c?.highlight === "boolean") return c.highlight;
  return isNamedAsRecommended(c?.name);
}

// "no price" = null / undefined / "" only; a stored 0 is a price
export function hasPrice(price) {
  return price !== null && price !== undefined && price !== "";
}

export function formatPrice(price) {
  if (!hasPrice(price)) return "";
  return `${Number(price).toLocaleString()} บาท`;
}

// option groups are only mentioned when the menu has some
export function optionSummary(m) {
  const groups = (m.optionGroups || []).length;
  return [
    `Add-on ${(m.addonIds || []).length}`,
    `Drink ${(m.drinkIds || []).length}`,
    groups > 0 ? `ตัวเลือก ${groups} กลุ่ม` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export async function safeJson(res) {
  const t = await res.text().catch(() => "");
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
}
