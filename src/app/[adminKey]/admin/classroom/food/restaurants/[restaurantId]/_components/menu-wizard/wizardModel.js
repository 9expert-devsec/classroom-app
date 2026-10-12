// form state, validation and payload for the add/edit menu wizard (pure)
import { toEditorGroups, toPayloadGroups } from "../OptionGroupsEditor";
import { idOf, menuCategoryIds } from "../menuUi";

export const NAME_MAX = 50;
export const DESCRIPTION_MAX = 500;
export const MIN_IMAGE_W = 800; // same as MIN_MENU_IMAGE_W (warning only)

function uniq(list) {
  return [...new Set(list.map(String).filter(Boolean))];
}

export function initialForm(menu, nextSortOrder) {
  if (!menu) {
    return {
      name: "",
      price: "",
      sortOrder: String(nextSortOrder ?? 0),
      categoryIds: [],
      imageUrl: "",
      description: "",
      addonIds: [],
      drinkIds: [],
      optionGroups: [],
    };
  }
  return {
    name: menu.name || "",
    price: menu.price === null || menu.price === undefined ? "" : String(menu.price),
    sortOrder: String(menu.sortOrder ?? 0),
    categoryIds: menuCategoryIds(menu),
    imageUrl: menu.imageUrl || "",
    description: menu.description || "",
    addonIds: uniq((menu.addonIds || []).map(idOf)),
    drinkIds: uniq((menu.drinkIds || []).map(idOf)),
    optionGroups: toEditorGroups(menu.optionGroups),
  };
}

/** step 1 field errors ({} = valid). needsCategory: shop has active categories */
export function infoErrors(form, { activeCategoryIds, needsCategory }) {
  const e = {};
  const name = form.name.trim();
  if (!name) e.name = "กรุณากรอกชื่อเมนู";
  else if (name.length > NAME_MAX) e.name = `ชื่อเมนูต้องไม่เกิน ${NAME_MAX} ตัวอักษร`;

  const priceRaw = String(form.price).trim();
  const price = Number(priceRaw);
  if (priceRaw === "") e.price = "กรุณากรอกราคา";
  else if (!Number.isFinite(price) || price < 0) e.price = "ราคาต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป";

  const orderRaw = String(form.sortOrder).trim();
  if (orderRaw !== "" && !Number.isInteger(Number(orderRaw))) {
    e.sortOrder = "ลำดับต้องเป็นจำนวนเต็ม";
  }

  if (needsCategory && !form.categoryIds.some((id) => activeCategoryIds.has(id))) {
    e.categoryIds = "กรุณาเลือกหมวดหมู่อย่างน้อย 1 หมวด";
  }

  if (form.description.length > DESCRIPTION_MAX) {
    e.description = `คำอธิบายต้องไม่เกิน ${DESCRIPTION_MAX} ตัวอักษร`;
  }
  return e;
}

/** step 2: the same option-group checks the old form ran before saving */
export function optionsError(form) {
  for (const g of form.optionGroups) {
    if (!String(g.name || "").trim()) return "กรุณากรอกชื่อกลุ่มตัวเลือกให้ครบ";
    if (!(g.choices || []).length) {
      return `กลุ่ม "${g.name}" ต้องมีตัวเลือกอย่างน้อย 1 รายการ`;
    }
    for (const c of g.choices || []) {
      if (!String(c.name || "").trim()) {
        return `กรุณากรอกชื่อตัวเลือกในกลุ่ม "${g.name}" ให้ครบ`;
      }
      const p = Number(c.priceDelta);
      if (!Number.isFinite(p) || p < 0) {
        return `ราคาตัวเลือกในกลุ่ม "${g.name}" ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป`;
      }
    }
  }
  return "";
}

/**
 * Same payload the old modal sent. Add-on / Drink ids are limited to the
 * shop's active items, as before.
 */
export function buildPayload(form, { restaurantId, activeAddonIds, activeDrinkIds, isActive }) {
  const payload = {
    restaurantId,
    name: form.name.trim(),
    imageUrl: form.imageUrl.trim(),
    addonIds: uniq(form.addonIds).filter((id) => activeAddonIds.has(id)),
    drinkIds: uniq(form.drinkIds).filter((id) => activeDrinkIds.has(id)),
    categoryIds: uniq(form.categoryIds),
    price: Number(String(form.price).trim()),
    description: form.description.trim(),
    sortOrder: Number(form.sortOrder) || 0,
    optionGroups: toPayloadGroups(form.optionGroups),
  };
  if (typeof isActive === "boolean") payload.isActive = isActive;
  return payload;
}

// comparable snapshot for "unsaved changes" (ignores UI-only keys)
export function snapshot(form) {
  return JSON.stringify({
    ...form,
    optionGroups: toPayloadGroups(form.optionGroups),
  });
}

export async function imageWidthOf(file) {
  try {
    const bmp = await createImageBitmap(file);
    const w = bmp.width;
    bmp.close?.();
    return w;
  } catch {
    return 0;
  }
}
