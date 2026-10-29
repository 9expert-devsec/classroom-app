// OS-3: กลุ่มตัวเลือกที่ผูกชุด (FoodOptionSet) บนฟอร์มเมนู — pure, client-side
//
// รูปบนฟอร์ม: { _uiKey, _id?, linked: true, sourceSetId, name, selectType, set,
//               required: "" | "yes" | "no"  (override; "" = ตามชุด),
//               minSelect / maxSelect: ""  (override; "" = ตามชุด),
//               choices: [{ _uiKey, _id?, sourceChoiceId, name, defaultPrice, priceDelta (string), hidden, setActive }],
//               detachFromSet?: true  (กลุ่มที่บันทึกแล้ว รอแยกเป็นของเมนูนี้ตอนบันทึก) }
//   set = { required, minSelect, maxSelect } ของชุด (ค่าเริ่มต้นที่ใช้แสดง "ตามชุด")
// payload ส่งเฉพาะสิ่งที่ server รับ: sourceSetId, _id, overrides, sortOrder, detachFromSet,
//   และต่อ choice: _id / sourceChoiceId, hidden, overrides.priceDelta
import { groupLimitsError, normalizeLimit } from "@/lib/optionGroupRules";

function uiKey() {
  return `ls-${Math.random().toString(36).slice(2, 10)}`;
}

function has(o, k) {
  return !!o && Object.prototype.hasOwnProperty.call(o, k);
}

const str = (x) => (x === null || x === undefined ? "" : String(x));

function setInfo(set, fallback) {
  return {
    required: !!(set ? set.required : fallback?.required),
    minSelect: (set ? set.minSelect : fallback?.minSelect) ?? null,
    maxSelect: (set ? set.maxSelect : fallback?.maxSelect) ?? null,
  };
}

/** linked group from the menu as loaded (set = the restaurant's set, if known) */
export function linkedFromMenuGroup(g, set) {
  const setChoice = new Map((set?.choices || []).map((c) => [String(c._id), c]));
  const ov = g.overrides || {};
  return {
    _uiKey: uiKey(),
    _id: g._id ? String(g._id) : undefined,
    linked: true,
    sourceSetId: String(g.sourceSetId),
    name: set?.name || g.name || "",
    selectType: (set?.selectType || g.selectType) === "multi" ? "multi" : "single",
    set: setInfo(set, g),
    required: has(ov, "required") ? (ov.required ? "yes" : "no") : "",
    minSelect: has(ov, "minSelect") ? str(ov.minSelect) : "",
    maxSelect: has(ov, "maxSelect") ? str(ov.maxSelect) : "",
    choices: (g.choices || []).map((c) => {
      const sc = setChoice.get(String(c.sourceChoiceId));
      const overridden = has(c.overrides, "priceDelta");
      // set not loaded: an existing override has no known default (null) and is kept as is
      const def = sc ? Number(sc.priceDelta) || 0 : overridden ? null : Number(c.priceDelta) || 0;
      return {
        _uiKey: uiKey(),
        _id: c._id ? String(c._id) : undefined,
        sourceChoiceId: String(c.sourceChoiceId || ""),
        name: c.name || "",
        defaultPrice: def,
        priceDelta: String(overridden ? Number(c.overrides.priceDelta) || 0 : def),
        hidden: !!c.hidden,
        setActive: sc ? sc.isActive !== false : c.isActive !== false || !!c.hidden,
      };
    }),
  };
}

/** new linked group built from the set's data (server makes the real ids on save) */
export function linkedFromSet(set) {
  return {
    _uiKey: uiKey(),
    linked: true,
    sourceSetId: String(set._id),
    name: set.name || "",
    selectType: set.selectType === "multi" ? "multi" : "single",
    set: setInfo(set),
    required: "",
    minSelect: "",
    maxSelect: "",
    choices: [...(set.choices || [])]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((c) => ({
        _uiKey: uiKey(),
        sourceChoiceId: String(c._id),
        name: c.name || "",
        defaultPrice: Number(c.priceDelta) || 0,
        priceDelta: String(Number(c.priceDelta) || 0),
        hidden: false,
        setActive: c.isActive !== false,
      })),
  };
}

/** effective required / min / max shown to learners */
export function effectiveOf(lg) {
  const required = lg.required === "" ? lg.set.required : lg.required === "yes";
  const minSelect = lg.minSelect === "" ? lg.set.minSelect : normalizeLimit(lg.minSelect, 0);
  const maxSelect = lg.maxSelect === "" ? lg.set.maxSelect : normalizeLimit(lg.maxSelect, 1);
  return { required, minSelect, maxSelect };
}

export function priceOverridden(c) {
  if (c.defaultPrice === null) return true;
  return String(c.priceDelta).trim() !== "" && Number(c.priceDelta) !== c.defaultPrice;
}

/** first problem with a linked group, or "" */
export function linkedGroupError(lg) {
  if (lg.detachFromSet) return "";
  const eff = effectiveOf(lg);
  const msg = groupLimitsError({ name: lg.name, selectType: lg.selectType, ...eff });
  if (msg) return msg;
  for (const c of lg.choices) {
    const p = Number(c.priceDelta);
    if (String(c.priceDelta).trim() === "" || !Number.isFinite(p) || p < 0) {
      return `ราคาตัวเลือก "${c.name}" ในกลุ่ม "${lg.name}" ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป`;
    }
  }
  if (eff.required && !lg.choices.some((c) => c.setActive && !c.hidden)) {
    return `กลุ่ม "${lg.name}" บังคับเลือก — ต้องแสดงตัวเลือกอย่างน้อย 1 รายการ`;
  }
  return "";
}

export function linkedToPayload(lg, sortOrder) {
  if (lg.detachFromSet) {
    return { ...(lg._id ? { _id: lg._id } : {}), sourceSetId: lg.sourceSetId, detachFromSet: true, sortOrder };
  }
  const overrides = {};
  if (lg.required !== "") overrides.required = lg.required === "yes";
  if (lg.selectType === "multi") {
    if (lg.minSelect !== "") overrides.minSelect = normalizeLimit(lg.minSelect, 0);
    if (lg.maxSelect !== "") overrides.maxSelect = normalizeLimit(lg.maxSelect, 1);
  }
  return {
    ...(lg._id ? { _id: lg._id } : {}),
    sourceSetId: lg.sourceSetId,
    sortOrder,
    overrides,
    choices: lg.choices.map((c) => ({
      ...(c._id ? { _id: c._id } : {}),
      sourceChoiceId: c.sourceChoiceId,
      hidden: !!c.hidden,
      overrides: priceOverridden(c) ? { priceDelta: Number(c.priceDelta) } : null,
    })),
  };
}

/**
 * unsaved linked group -> plain menu-only editor group with the values shown now
 * (a saved one keeps detachFromSet instead, so the server does the detach)
 */
export function linkedToMenuOnly(lg) {
  const eff = effectiveOf(lg);
  return {
    _uiKey: uiKey(),
    name: lg.name,
    required: !!eff.required,
    selectType: lg.selectType,
    minSelect: lg.selectType === "multi" ? str(eff.minSelect) : "",
    maxSelect: lg.selectType === "multi" ? str(eff.maxSelect) : "",
    choices: lg.choices.map((c) => ({
      _uiKey: uiKey(),
      name: c.name,
      priceDelta: Number(c.priceDelta) || 0,
      isActive: c.setActive && !c.hidden,
    })),
  };
}
