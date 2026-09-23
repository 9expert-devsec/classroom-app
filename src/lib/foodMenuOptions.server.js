// src/lib/foodMenuOptions.server.js
// ตรวจและ normalize ฟิลด์ใหม่ของ FoodMenu (P1b) ใช้ร่วมกันระหว่าง
// POST /api/admin/food/menu และ PUT /api/admin/food/menu/[id]
import mongoose from "mongoose";

export const DESCRIPTION_MAX = 300;

export class FoodMenuFieldError extends Error {
  constructor(message) {
    super(message);
    this.name = "FoodMenuFieldError";
    this.status = 400;
  }
}

function isObjectId(x) {
  return mongoose.Types.ObjectId.isValid(String(x || ""));
}

function clean(x) {
  return String(x ?? "").trim();
}

// ยอมรับเฉพาะ _id เดิมที่ client ส่งกลับมา (เพื่อคงตัวเลือกเดิมไว้)
// ตัวไหนไม่มี/ไม่ใช่ ObjectId ปล่อยให้ mongoose สร้างใหม่
function keepId(raw) {
  const id = clean(raw);
  return id && isObjectId(id) ? { _id: id } : {};
}

export function normalizeDescription(raw) {
  const s = clean(raw);
  if (s.length > DESCRIPTION_MAX) {
    throw new FoodMenuFieldError(
      `คำอธิบายยาวเกินไป (ไม่เกิน ${DESCRIPTION_MAX} ตัวอักษร)`,
    );
  }
  return s;
}

// null = ไม่กำหนดราคา (ร้าน set menu เดิมไม่ต้องมีราคา)
export function normalizePrice(raw) {
  if (raw === null || raw === "" || raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new FoodMenuFieldError("ราคาต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
  }
  return n;
}

export function normalizeSortOrder(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeOptionGroups(raw) {
  if (!Array.isArray(raw)) {
    throw new FoodMenuFieldError("optionGroups ต้องเป็น array");
  }

  return raw.map((g, gi) => {
    const name = clean(g?.name);
    if (!name) {
      throw new FoodMenuFieldError(`กรุณากรอกชื่อกลุ่มตัวเลือกลำดับที่ ${gi + 1}`);
    }

    const selectType = clean(g?.selectType) || "single";
    if (!["single", "multi"].includes(selectType)) {
      throw new FoodMenuFieldError(`ประเภทการเลือกของกลุ่ม "${name}" ไม่ถูกต้อง`);
    }

    const rawChoices = Array.isArray(g?.choices) ? g.choices : [];
    if (rawChoices.length === 0) {
      throw new FoodMenuFieldError(`กลุ่ม "${name}" ต้องมีตัวเลือกอย่างน้อย 1 รายการ`);
    }

    const choices = rawChoices.map((c, ci) => {
      const cname = clean(c?.name);
      if (!cname) {
        throw new FoodMenuFieldError(
          `กรุณากรอกชื่อตัวเลือกลำดับที่ ${ci + 1} ในกลุ่ม "${name}"`,
        );
      }

      const priceDelta = Number(c?.priceDelta ?? 0);
      if (!Number.isFinite(priceDelta) || priceDelta < 0) {
        throw new FoodMenuFieldError(
          `ราคาเพิ่มของตัวเลือก "${cname}" ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป`,
        );
      }

      return {
        ...keepId(c?._id),
        name: cname,
        priceDelta,
        sortOrder: Number.isFinite(Number(c?.sortOrder)) ? Number(c.sortOrder) : ci,
        isActive: c?.isActive !== false,
      };
    });

    return {
      ...keepId(g?._id),
      name,
      required: !!g?.required,
      selectType,
      sortOrder: Number.isFinite(Number(g?.sortOrder)) ? Number(g.sortOrder) : gi,
      choices,
    };
  });
}

// 1 เมนูอยู่ได้หลายหมวด แต่ต้องเป็นหมวดของร้านเดียวกันทั้งหมด
// null / "" / [] / ไม่ส่งมา = ไม่มีหมวดหมู่
export async function resolveCategoryIds(raw, restaurantId, FoodMenuCategory) {
  if (raw === null || raw === "" || raw === undefined) return [];

  // เผื่อ client เก่าที่ส่ง categoryId เดี่ยวมา
  const list = Array.isArray(raw) ? raw : [raw];

  const ids = [];
  for (const one of list) {
    const id = clean(one);
    if (!id) continue;
    if (!isObjectId(id)) {
      throw new FoodMenuFieldError("หมวดหมู่ไม่ถูกต้อง");
    }
    if (!ids.includes(id)) ids.push(id);
  }
  if (ids.length === 0) return [];

  const cats = await FoodMenuCategory.find({ _id: { $in: ids } })
    .select("restaurant name")
    .lean();

  const byId = new Map(cats.map((c) => [String(c._id), c]));

  for (const id of ids) {
    const cat = byId.get(id);
    if (!cat) throw new FoodMenuFieldError("ไม่พบหมวดหมู่ที่เลือก");
    if (String(cat.restaurant) !== String(restaurantId)) {
      throw new FoodMenuFieldError(
        `หมวดหมู่ "${cat.name}" ไม่ได้อยู่ในร้านนี้`,
      );
    }
  }

  return ids;
}
