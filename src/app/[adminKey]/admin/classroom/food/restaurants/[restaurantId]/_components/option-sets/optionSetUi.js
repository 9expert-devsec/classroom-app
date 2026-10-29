// shared helpers for the ชุดตัวเลือก (FoodOptionSet) tab — client-side only
import { normalizeLimit, groupLimitsError } from "@/lib/optionGroupRules";

export const OPTION_SET_NAME_MAX = 60;

export function idStr(x) {
  return x ? String(x._id || x) : "";
}

export function plusPrice(n) {
  const v = Number(n) || 0;
  return v > 0 ? `+${v.toLocaleString()}` : "";
}

/** chips on the card: "เลือก 1" | "หลายอย่าง · สูงสุด N", "บังคับ" | "ไม่บังคับ" */
export function setChips(set) {
  const multi = set?.selectType === "multi";
  const max = set?.maxSelect ?? null;
  return [
    multi ? `หลายอย่าง${max !== null ? ` · สูงสุด ${max}` : ""}` : "เลือก 1",
    set?.required ? "บังคับ" : "ไม่บังคับ",
  ];
}

/** "À la carte · Set (ข้าว + เครื่องดื่ม) +40 และอีก 2" — active choices only */
export function choicePreview(set, shown = 3) {
  const active = (set?.choices || []).filter((c) => c.isActive !== false);
  if (!active.length) return "ยังไม่มีตัวเลือกที่เปิดใช้";
  const head = active
    .slice(0, shown)
    .map((c) => [c.name, plusPrice(c.priceDelta)].filter(Boolean).join(" "))
    .join(" · ");
  const more = active.length - shown;
  return more > 0 ? `${head} และอีก ${more}` : head;
}

/* ---------------- form ---------------- */

let keySeq = 0;
function uiKey() {
  keySeq += 1;
  return `oc-${Date.now().toString(36)}-${keySeq}`;
}

export function emptyChoice() {
  return { _key: uiKey(), name: "", priceDelta: "0", isActive: true };
}

export function toForm(set) {
  if (!set) {
    return {
      name: "",
      selectType: "single",
      required: false,
      minSelect: "",
      maxSelect: "",
      choices: [emptyChoice()],
    };
  }
  return {
    name: set.name || "",
    selectType: set.selectType === "multi" ? "multi" : "single",
    required: !!set.required,
    minSelect: set.minSelect ?? "",
    maxSelect: set.maxSelect ?? "",
    choices: [...(set.choices || [])]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((c) => ({
        _key: uiKey(),
        _id: idStr(c._id),
        name: c.name || "",
        priceDelta: String(Number(c.priceDelta) || 0),
        isActive: c.isActive !== false,
      })),
  };
}

/** min/max only apply to multi; blank = no limit */
function limitsOf(form) {
  if (form.selectType !== "multi") return { minSelect: null, maxSelect: null };
  return {
    minSelect: normalizeLimit(form.minSelect, 0),
    maxSelect: normalizeLimit(form.maxSelect, 1),
  };
}

/** inline errors; the limit rule comes from optionGroupRules (same as the server) */
export function validateForm(form) {
  const errors = {};
  const name = form.name.trim();
  if (!name) errors.name = "กรุณากรอกชื่อชุด";

  const { minSelect, maxSelect } = limitsOf(form);
  const limitsMsg = groupLimitsError({
    name,
    selectType: form.selectType,
    required: form.required,
    minSelect,
    maxSelect,
  });
  if (limitsMsg) errors.limits = limitsMsg;

  if (form.choices.length === 0) errors.choices = "ต้องมีตัวเลือกอย่างน้อย 1 รายการ";
  else if (form.choices.some((c) => !c.name.trim())) errors.choices = "กรุณากรอกชื่อตัวเลือกให้ครบ";
  else if (form.choices.some((c) => !Number.isFinite(Number(c.priceDelta)) || Number(c.priceDelta) < 0 || c.priceDelta === "")) {
    errors.choices = "ราคาเพิ่มต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป";
  } else if (form.required && !form.choices.some((c) => c.isActive)) {
    errors.choices = "ชุดที่บังคับเลือกต้องมีตัวเลือกที่เปิดใช้อย่างน้อย 1 รายการ";
  }
  return errors;
}

export function toPayload(form) {
  const { minSelect, maxSelect } = limitsOf(form);
  return {
    name: form.name.trim(),
    selectType: form.selectType,
    required: !!form.required,
    minSelect,
    maxSelect,
    choices: form.choices.map((c) => ({
      ...(c._id ? { _id: c._id } : {}),
      name: c.name.trim(),
      priceDelta: Number(c.priceDelta) || 0,
      isActive: c.isActive !== false,
    })),
  };
}

/* ---------------- what changes (confirm modal) ---------------- */

function limitText(s) {
  if (s.selectType !== "multi") return "เลือก 1";
  const min = s.minSelect ?? null;
  const max = s.maxSelect ?? null;
  const parts = ["หลายอย่าง"];
  if (min !== null) parts.push(`ต่ำสุด ${min}`);
  if (max !== null) parts.push(`สูงสุด ${max}`);
  return parts.join(" · ");
}

/**
 * before = saved set, after = payload
 * kind: add | rename | price | off | on | remove | setting  (add = green tag, the rest neutral)
 */
export function computeChanges(before, after) {
  const out = [];
  if ((before.name || "") !== after.name) {
    out.push({ kind: "rename", tag: "แก้ชื่อ", text: `ชื่อชุด: ${before.name} → ${after.name}` });
  }
  if (limitText(before) !== limitText(after)) {
    out.push({ kind: "setting", tag: "ตั้งค่า", text: `${limitText(before)} → ${limitText(after)}` });
  }
  if (!!before.required !== !!after.required) {
    out.push({
      kind: "setting",
      tag: "ตั้งค่า",
      text: after.required ? "ไม่บังคับ → บังคับเลือก" : "บังคับเลือก → ไม่บังคับ",
    });
  }

  const oldById = new Map((before.choices || []).map((c) => [idStr(c._id), c]));
  const kept = new Set();
  for (const c of after.choices) {
    const prev = c._id ? oldById.get(c._id) : null;
    if (!prev) {
      out.push({ kind: "add", tag: "เพิ่ม", text: [c.name, plusPrice(c.priceDelta)].filter(Boolean).join(" ") });
      continue;
    }
    kept.add(c._id);
    if (prev.name !== c.name) out.push({ kind: "rename", tag: "แก้ชื่อ", text: `${prev.name} → ${c.name}` });
    const p0 = Number(prev.priceDelta) || 0;
    const p1 = Number(c.priceDelta) || 0;
    if (p0 !== p1) out.push({ kind: "price", tag: "ราคา", text: `${c.name}: +${p0} → +${p1}` });
    if (prev.isActive !== false && !c.isActive) out.push({ kind: "off", tag: "ปิดใช้", text: c.name });
    if (prev.isActive === false && c.isActive) out.push({ kind: "on", tag: "เปิดใช้", text: c.name });
  }
  for (const [id, c] of oldById) {
    if (!kept.has(id)) out.push({ kind: "remove", tag: "ลบ", text: c.name });
  }
  return out;
}

/** "Momiji Don · Set +50" (one chip per menu, overrides joined) */
export function overrideChipText(menu) {
  const parts = (menu.overrides || []).map((o) => `${o.choiceName} ${plusPrice(o.priceDelta) || "+0"}`);
  return parts.length ? `${menu.name} · ${parts.join(", ")}` : menu.name;
}

/** case-insensitive, trimmed */
export function sameGroupName(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}
