// shared helpers for the ชุดอาหาร (FoodSet) tab — client-side only
import { idOf } from "../menuUi";

export const SET_NAME_MAX = 50;

/** last token if it is 1–2 chars ("ชุดอาหาร A", "Set 12"), else first char */
export function setAvatarLetter(name) {
  const clean = String(name || "").trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/);
  const last = parts[parts.length - 1];
  if (parts.length > 1 && [...last].length <= 2) return last.toUpperCase();
  return [...clean][0].toUpperCase();
}

/** set's menus in stored order; ids of deleted menus are skipped */
export function menusInSet(set, menuById) {
  return (set?.menuIds || []).map((x) => menuById.get(idOf(x))).filter(Boolean);
}

export function SetAvatar({ name, size = "md" }) {
  const cls = size === "lg" ? "h-14 w-14 text-2xl" : size === "sm" ? "h-9 w-9 text-base" : "h-11 w-11 text-xl";
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-600 ${cls}`}
      aria-hidden
    >
      {setAvatarLetter(name)}
    </div>
  );
}
