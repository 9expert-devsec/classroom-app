// src/lib/foodOptionSets.server.js
//
// OS-1: ชุดตัวเลือกของร้าน (FoodOptionSet) ที่ผูกกับหลายเมนูได้
//
// หลักการ:
//   - เมนูที่ผูกชุดเก็บสำเนาแบบ embedded ใน FoodMenu.optionGroups[] (sourceSetId = ชุด)
//     สำเนาเก็บ "ค่าที่มีผลจริง" เสมอ ผู้อ่านเดิม (หน้าผู้เรียน / ตะกร้า / submit / รายงาน) จึงไม่ต้องแก้
//   - override ของเมนู: กลุ่ม = overrides.{required,minSelect,maxSelect} · ตัวเลือก = hidden + overrides.priceDelta
//     key ที่ไม่มี = ใช้ค่าของชุด
//   - _id ของกลุ่ม/ตัวเลือกใน embedded ถูกสร้างครั้งเดียวตอนผูก และไม่เปลี่ยนอีกเลย
//     (ตะกร้าใน localStorage และ submit อ้าง _id เหล่านี้) — sync จับคู่ตัวเลือกด้วย sourceChoiceId
//   - เขียนหลายเอกสารใน transaction เดียว (แบบเดียวกับ lunchActions.server.js)
//
// import แบบ relative + นามสกุลเต็ม เพื่อให้รันจาก Node ตรง ๆ ได้ (สคริปต์ตรวจสอบ)
import mongoose from "mongoose";

import FoodOptionSet from "../models/FoodOptionSet.js";
import FoodMenu from "../models/FoodMenu.js";
import Restaurant from "../models/Restaurant.js";
import { normalizeOptionGroup, FoodMenuFieldError } from "./foodMenuOptions.server.js";
import { normalizeLimit, groupLimitsError, effectiveLimits } from "./optionGroupRules.js";

const { ObjectId } = mongoose.Types;

export class OptionSetError extends Error {
  constructor(message, status = 400, details = null) {
    super(message);
    this.name = "OptionSetError";
    this.status = status;
    this.details = details;
  }
}

/* ---------------- helpers ---------------- */

function clean(x) {
  return String(x ?? "").trim();
}

function has(o, k) {
  return !!o && Object.prototype.hasOwnProperty.call(o, k);
}

function isId(x) {
  return ObjectId.isValid(clean(x));
}

function sameId(a, b) {
  return a != null && b != null && String(a) === String(b);
}

function bySort(a, b) {
  return (Number(a?.sortOrder) || 0) - (Number(b?.sortOrder) || 0);
}

function assertId(x, what) {
  if (!isId(x)) throw new OptionSetError(`${what}ไม่ถูกต้อง`, 400);
  return new ObjectId(clean(x));
}

async function inTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let out;
    await session.withTransaction(async () => {
      out = await fn(session);
    });
    return out;
  } finally {
    await session.endSession();
  }
}

function isDuplicateKey(e) {
  return e?.code === 11000 || e?.cause?.code === 11000;
}

/* ---------------- overrides ---------------- */

// เก็บเฉพาะ key ที่อนุญาต · ไม่มี key เลย = undefined (ไม่เก็บ field)
function sanitizeGroupOverrides(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  const out = {};
  if (has(raw, "required")) out.required = !!raw.required;
  if (has(raw, "minSelect")) out.minSelect = normalizeLimit(raw.minSelect, 0);
  if (has(raw, "maxSelect")) out.maxSelect = normalizeLimit(raw.maxSelect, 1);
  if (Number.isNaN(out.minSelect) || Number.isNaN(out.maxSelect)) {
    throw new OptionSetError("ค่า override จำนวนขั้นต่ำ/สูงสุดไม่ถูกต้อง", 400);
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizeChoiceOverrides(raw) {
  if (!raw || typeof raw !== "object" || !has(raw, "priceDelta")) return undefined;
  if (raw.priceDelta === null || raw.priceDelta === "") return undefined;
  const n = Number(raw.priceDelta);
  if (!Number.isFinite(n) || n < 0) {
    throw new OptionSetError("ราคา override ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป", 400);
  }
  return { priceDelta: n };
}

/* ---------------- set input ---------------- */

/**
 * ตรวจ + normalize ข้อมูลชุดจาก client
 * _id ของตัวเลือกคงไว้เฉพาะตัวที่มีอยู่ในชุดเดิม (current) — ตัวอื่นได้ _id ใหม่
 */
export function normalizeOptionSetInput(raw, { current = null } = {}) {
  const name = clean(raw?.name);
  if (!name) throw new OptionSetError("กรุณากรอกชื่อชุดตัวเลือก", 400);

  const selectType = clean(raw?.selectType) || "single";
  if (!["single", "multi"].includes(selectType)) {
    throw new OptionSetError(`ประเภทการเลือกของชุด "${name}" ไม่ถูกต้อง`, 400);
  }
  const required = !!raw?.required;
  const minSelect = normalizeLimit(raw?.minSelect, 0);
  const maxSelect = normalizeLimit(raw?.maxSelect, 1);
  const limitsMsg = groupLimitsError({ name, selectType, required, minSelect, maxSelect });
  if (limitsMsg) throw new OptionSetError(limitsMsg, 400);

  const rawChoices = Array.isArray(raw?.choices) ? raw.choices : [];
  if (rawChoices.length === 0) {
    throw new OptionSetError(`ชุด "${name}" ต้องมีตัวเลือกอย่างน้อย 1 รายการ`, 400);
  }

  const known = new Set((current?.choices || []).map((c) => String(c._id)));
  const seen = new Set();
  const choices = rawChoices.map((c, ci) => {
    const cname = clean(c?.name);
    if (!cname) {
      throw new OptionSetError(`กรุณากรอกชื่อตัวเลือกลำดับที่ ${ci + 1} ในชุด "${name}"`, 400);
    }
    const priceDelta = Number(c?.priceDelta ?? 0);
    if (!Number.isFinite(priceDelta) || priceDelta < 0) {
      throw new OptionSetError(`ราคาเพิ่มของตัวเลือก "${cname}" ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป`, 400);
    }
    const id = clean(c?._id);
    const keep = id && known.has(id) && !seen.has(id);
    if (keep) seen.add(id);
    return {
      _id: keep ? new ObjectId(id) : new ObjectId(),
      name: cname,
      priceDelta,
      sortOrder: ci,
      isActive: c?.isActive !== false,
    };
  });

  if (required && !choices.some((c) => c.isActive)) {
    throw new OptionSetError(
      `ชุด "${name}" บังคับเลือก — ต้องเหลือตัวเลือกที่เปิดใช้งานอย่างน้อย 1 รายการ (ปิดหรือลบตัวเลือกสุดท้ายไม่ได้)`,
      400,
    );
  }

  const sortOrder = Number(raw?.sortOrder);
  return {
    name,
    selectType,
    required,
    minSelect,
    maxSelect,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : current?.sortOrder ?? 0,
    choices,
  };
}

/* ---------------- materialise / sync ---------------- */

/**
 * สร้างกลุ่ม embedded ของเมนูจากชุด
 *   embedded = กลุ่มเดิมของเมนู (หรือข้อมูลเท่าที่มี: _id, sortOrder, overrides, choices[{_id, sourceChoiceId, hidden, overrides}])
 *   ตัวเลือกจับคู่ด้วย sourceChoiceId: ตัวเดิมคง _id · ตัวใหม่ในชุดได้ _id ใหม่ · ตัวที่ลบจากชุดหายไป
 */
export function materializeGroup(set, embedded = null, { sortOrder = 0 } = {}) {
  const gOv = sanitizeGroupOverrides(embedded?.overrides);
  const lim = effectiveLimits(set, gOv);

  const prevBySource = new Map();
  for (const c of embedded?.choices || []) {
    if (c?.sourceChoiceId) prevBySource.set(String(c.sourceChoiceId), c);
  }

  const choices = [...(set.choices || [])].sort(bySort).map((sc, i) => {
    const prev = prevBySource.get(String(sc._id));
    const cOv = sanitizeChoiceOverrides(prev?.overrides);
    const hidden = !!prev?.hidden;
    return {
      _id: prev?._id || new ObjectId(),
      name: sc.name,
      priceDelta: cOv ? cOv.priceDelta : Number(sc.priceDelta) || 0,
      sortOrder: i,
      isActive: sc.isActive !== false && !hidden,
      sourceChoiceId: sc._id,
      hidden,
      ...(cOv ? { overrides: cOv } : {}),
    };
  });

  return {
    _id: embedded?._id || new ObjectId(),
    name: set.name,
    required: lim.required,
    selectType: set.selectType === "multi" ? "multi" : "single",
    minSelect: lim.minSelect,
    maxSelect: lim.maxSelect,
    sortOrder: Number.isFinite(Number(embedded?.sortOrder)) ? Number(embedded.sortOrder) : sortOrder,
    choices,
    sourceSetId: set._id,
    ...(gOv ? { overrides: gOv } : {}),
  };
}

/** ข้อผิดพลาดของกลุ่มที่ materialise แล้ว (ค่าที่มีผลจริงบนเมนูนั้น) หรือ null */
function materializedError(g) {
  const msg = groupLimitsError(g);
  if (msg) return msg;
  if (g.required && !(g.choices || []).some((c) => c.isActive)) {
    return `กลุ่ม "${g.name}" บังคับเลือก แต่ไม่มีตัวเลือกที่แสดงบนเมนูนี้เลย`;
  }
  return null;
}

/** กลุ่มที่ผูกชุด -> กลุ่มของเมนูเอง: คงค่าที่มีผลจริงตอนนี้ไว้ทั้งหมด (รวม isActive ของแต่ละตัวเลือก) */
function detachGroup(g) {
  return {
    _id: g._id,
    name: g.name,
    required: !!g.required,
    selectType: g.selectType === "multi" ? "multi" : "single",
    minSelect: g.minSelect ?? null,
    maxSelect: g.maxSelect ?? null,
    sortOrder: g.sortOrder ?? 0,
    sourceSetId: null,
    choices: (g.choices || []).map((c) => ({
      _id: c._id,
      name: c.name,
      priceDelta: Number(c.priceDelta) || 0,
      sortOrder: c.sortOrder ?? 0,
      isActive: c.isActive !== false,
      sourceChoiceId: null,
      hidden: false,
    })),
  };
}

function diffGroup(oldG, newG) {
  const oldBy = new Map((oldG?.choices || []).map((c) => [String(c.sourceChoiceId), c]));
  const newBy = new Map((newG?.choices || []).map((c) => [String(c.sourceChoiceId), c]));
  const added = [];
  const renamed = [];
  for (const [k, c] of newBy) {
    const prev = oldBy.get(k);
    if (!prev) added.push(c.name);
    else if (prev.name !== c.name) renamed.push({ from: prev.name, to: c.name });
  }
  const removed = [];
  const lostOverrides = [];
  for (const [k, c] of oldBy) {
    if (newBy.has(k)) continue;
    removed.push(c.name);
    const kinds = [];
    if (c.hidden) kinds.push("hidden");
    if (has(c.overrides, "priceDelta")) kinds.push("priceDelta");
    if (kinds.length) lostOverrides.push({ choice: c.name, kinds });
  }
  return { added, removed, renamed, lostOverrides };
}

/**
 * sync ชุดเข้าเมนู 1 เมนู (ไม่เขียน) — ใช้ร่วมทั้ง preview / update
 * คืน { optionGroups, groups:[{groupId, ...diff}], error }
 */
function syncSetToMenu(set, menu) {
  const groups = [];
  let error = null;
  const optionGroups = (menu.optionGroups || []).map((g) => {
    if (!sameId(g.sourceSetId, set._id)) return g;
    const next = materializeGroup(set, g);
    groups.push({ groupId: String(g._id), ...diffGroup(g, next) });
    error = error || materializedError(next);
    return next;
  });
  return { optionGroups, groups, error };
}

async function linkedMenus(setId, session = null) {
  return FoodMenu.find({ "optionGroups.sourceSetId": setId })
    .select("name restaurant optionGroups")
    .session(session)
    .lean();
}

async function loadSet(setId, session = null) {
  const set = await FoodOptionSet.findById(assertId(setId, "รหัสชุดตัวเลือก"))
    .session(session)
    .lean();
  if (!set) throw new OptionSetError("ไม่พบชุดตัวเลือก", 404);
  return set;
}

async function computeImpact(current, proposed, session = null) {
  const next = proposed
    ? {
        ...normalizeOptionSetInput(proposed, { current }),
        _id: current._id,
        restaurant: current.restaurant,
      }
    : current;

  const menus = await linkedMenus(current._id, session);
  const rows = menus.map((m) => {
    const r = syncSetToMenu(next, m);
    return { menu: m, optionGroups: r.optionGroups, groups: r.groups, error: r.error };
  });

  return {
    next,
    rows,
    impact: {
      set: { id: String(current._id), name: next.name },
      menus: rows.map((r) => {
        const g = r.groups[0] || { added: [], removed: [], renamed: [], lostOverrides: [] };
        return {
          id: String(r.menu._id),
          name: r.menu.name || "",
          added: g.added,
          removed: g.removed,
          renamed: g.renamed,
          lostOverrides: g.lostOverrides,
          error: r.error,
        };
      }),
      blocking: rows
        .filter((r) => r.error)
        .map((r) => ({ menuId: String(r.menu._id), menuName: r.menu.name || "", reason: r.error })),
    },
  };
}

async function assertNameFree(restaurant, name, exceptId, session) {
  const dup = await FoodOptionSet.findOne({
    restaurant,
    name,
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  })
    .select("_id")
    .session(session)
    .lean();
  if (dup) throw new OptionSetError(`มีชุดตัวเลือกชื่อ "${name}" ในร้านนี้แล้ว`, 409);
}

/* ---------------- reads ---------------- */

/**
 * withUsage (OS-2): เพิ่ม overrideCount + menus[{ _id, name, hasOverride, overrides[{ sourceChoiceId, choiceName, priceDelta }] }]
 *   override = ตัวเลือกในกลุ่มนั้นของเมนูที่มี overrides.priceDelta
 */
export async function listOptionSets(restaurantId, { withUsage = false } = {}) {
  const rid = assertId(restaurantId, "รหัสร้าน");
  const [sets, menus] = await Promise.all([
    FoodOptionSet.find({ restaurant: rid }).sort({ sortOrder: 1, name: 1 }).lean(),
    // $elemMatch: "any group linked" ($ne on the array path would mean "no group unlinked")
    FoodMenu.find({ restaurant: rid, optionGroups: { $elemMatch: { sourceSetId: { $ne: null } } } })
      .select("name sortOrder optionGroups.sourceSetId optionGroups.choices")
      .sort({ sortOrder: 1, name: 1 })
      .lean(),
  ]);
  const usage = new Map();
  for (const m of menus) {
    for (const g of m.optionGroups || []) {
      if (!g.sourceSetId) continue;
      const key = String(g.sourceSetId);
      const overrides = (g.choices || [])
        .filter((c) => has(c.overrides, "priceDelta"))
        .map((c) => ({
          sourceChoiceId: String(c.sourceChoiceId || ""),
          choiceName: c.name || "",
          priceDelta: Number(c.overrides.priceDelta) || 0,
        }));
      if (!usage.has(key)) usage.set(key, []);
      usage.get(key).push({
        _id: String(m._id),
        name: m.name || "",
        hasOverride: overrides.length > 0,
        overrides,
      });
    }
  }
  return sets.map((s) => {
    const used = usage.get(String(s._id)) || [];
    return {
      ...s,
      menuCount: used.length,
      ...(withUsage
        ? { overrideCount: used.filter((u) => u.hasOverride).length, menus: used }
        : {}),
    };
  });
}

export async function getOptionSet(setId) {
  const set = await loadSet(setId);
  const menus = await linkedMenus(set._id);
  return { ...set, menus: menus.map((m) => ({ id: String(m._id), name: m.name || "" })) };
}

/* ---------------- writes ---------------- */

export async function createOptionSet(restaurantId, raw) {
  const rid = assertId(restaurantId, "รหัสร้าน");
  const rest = await Restaurant.findById(rid).select("_id").lean();
  if (!rest) throw new OptionSetError("ไม่พบร้าน", 404);

  const input = normalizeOptionSetInput(raw);
  await FoodOptionSet.init(); // unique (restaurant, name) ต้องพร้อมก่อนเขียนครั้งแรก
  await assertNameFree(rid, input.name, null, null);
  try {
    const doc = await FoodOptionSet.create({ ...input, restaurant: rid });
    return doc.toObject();
  } catch (e) {
    if (isDuplicateKey(e)) throw new OptionSetError(`มีชุดตัวเลือกชื่อ "${input.name}" ในร้านนี้แล้ว`, 409);
    throw e;
  }
}

/** ไม่เขียนอะไรเลย — เมนูที่ผูกอยู่ + ผลกระทบต่อแต่ละเมนู ถ้าบันทึก proposed */
export async function previewOptionSetImpact(setId, proposed) {
  const current = await loadSet(setId);
  const { impact } = await computeImpact(current, proposed || null);
  return impact;
}

/** บันทึกชุด แล้ว sync ทุกเมนูที่ผูกอยู่ใน transaction เดียว · มีเมนูที่ผิดกติกา = ไม่บันทึกเลย (422) */
export async function updateOptionSet(setId, raw) {
  try {
    return await inTransaction(async (session) => {
      const current = await loadSet(setId, session);
      const { next, rows, impact } = await computeImpact(current, raw, session);
      if (impact.blocking.length) {
        throw new OptionSetError(
          `บันทึกไม่ได้: ${impact.blocking.map((b) => `${b.menuName} — ${b.reason}`).join(" · ")}`,
          422,
          impact,
        );
      }
      await assertNameFree(current.restaurant, next.name, current._id, session);

      const doc = await FoodOptionSet.findById(current._id).session(session);
      doc.set({
        name: next.name,
        selectType: next.selectType,
        required: next.required,
        minSelect: next.minSelect,
        maxSelect: next.maxSelect,
        sortOrder: next.sortOrder,
        choices: next.choices,
      });
      await doc.save({ session });

      for (const r of rows) {
        await FoodMenu.updateOne(
          { _id: r.menu._id },
          { $set: { optionGroups: r.optionGroups } },
          { session },
        );
      }
      return { before: current, item: doc.toObject(), impact };
    });
  } catch (e) {
    if (isDuplicateKey(e)) throw new OptionSetError("มีชุดตัวเลือกชื่อนี้ในร้านนี้แล้ว", 409);
    throw e;
  }
}

/**
 * ผูกชุดกับหลายเมนู · เมนูที่ผูกอยู่แล้วข้าม · เมนูของร้านอื่น = ปฏิเสธทั้งคำขอ
 * OS-2: replace [{ menuId, groupId }] = ดึงกลุ่มของเมนูเอง (ชื่อซ้ำกับชุด) ออก แล้วใส่กลุ่มของชุดแทนที่ตำแหน่งเดิม
 *       ใน transaction เดียวกัน · groupId ต้องเป็นกลุ่มของเมนูนั้นและยังไม่ผูกชุด
 */
export async function attachOptionSetToMenus(setId, menuIds, { replace = [] } = {}) {
  const ids = [...new Set((Array.isArray(menuIds) ? menuIds : []).map(clean))];
  if (!ids.length) throw new OptionSetError("กรุณาเลือกเมนูอย่างน้อย 1 รายการ", 400);
  const oids = ids.map((x) => assertId(x, "รหัสเมนู"));

  const replaceByMenu = new Map();
  for (const r of Array.isArray(replace) ? replace : []) {
    const mid = clean(r?.menuId);
    assertId(mid, "รหัสเมนู");
    assertId(r?.groupId, "รหัสกลุ่มตัวเลือก");
    if (!ids.includes(mid)) throw new OptionSetError("เมนูที่จะแทนที่กลุ่มต้องอยู่ในรายการที่เลือก", 400);
    if (replaceByMenu.has(mid)) throw new OptionSetError("แทนที่กลุ่มได้เมนูละ 1 กลุ่ม", 400);
    replaceByMenu.set(mid, clean(r.groupId));
  }

  return inTransaction(async (session) => {
    const set = await loadSet(setId, session);
    const menus = await FoodMenu.find({ _id: { $in: oids } })
      .select("name restaurant optionGroups")
      .session(session)
      .lean();

    const found = new Set(menus.map((m) => String(m._id)));
    const missing = ids.filter((x) => !found.has(x));
    if (missing.length) throw new OptionSetError("ไม่พบเมนูบางรายการ", 404, { missing });

    const foreign = menus.filter((m) => !sameId(m.restaurant, set.restaurant));
    if (foreign.length) {
      throw new OptionSetError(
        `เมนูต่อไปนี้ไม่ได้อยู่ในร้านของชุดนี้: ${foreign.map((m) => m.name).join(", ")}`,
        400,
        { foreign: foreign.map((m) => String(m._id)) },
      );
    }

    const attached = [];
    const skipped = [];
    const replaced = [];
    for (const m of menus) {
      const groups = m.optionGroups || [];
      const replaceId = replaceByMenu.get(String(m._id)) || "";
      const target = replaceId ? groups.find((g) => sameId(g._id, replaceId)) : null;
      if (replaceId && !target) {
        throw new OptionSetError(`${m.name}: ไม่พบกลุ่มตัวเลือกที่จะแทนที่ในเมนูนี้`, 400);
      }
      if (target?.sourceSetId) {
        throw new OptionSetError(`${m.name}: กลุ่ม "${target.name}" ผูกกับชุดตัวเลือกอยู่แล้ว แทนที่ไม่ได้`, 400);
      }
      if (groups.some((g) => sameId(g.sourceSetId, set._id))) {
        skipped.push(String(m._id));
        continue;
      }
      const maxSort = groups.reduce((n, g) => Math.max(n, Number(g.sortOrder) || 0), -1);
      const g = materializeGroup(set, null, { sortOrder: target ? Number(target.sortOrder) || 0 : maxSort + 1 });
      const err = materializedError(g);
      if (err) throw new OptionSetError(`${m.name}: ${err}`, 422);
      if (target) {
        const optionGroups = groups.map((x) => (sameId(x._id, target._id) ? g : x));
        await FoodMenu.updateOne({ _id: m._id }, { $set: { optionGroups } }, { session });
        replaced.push({ menuId: String(m._id), groupId: String(target._id), groupName: target.name || "" });
      } else {
        await FoodMenu.updateOne({ _id: m._id }, { $push: { optionGroups: g } }, { session });
      }
      attached.push({ menuId: String(m._id), menuName: m.name || "", groupId: String(g._id) });
    }
    return { set: { id: String(set._id), name: set.name }, attached, skipped, replaced };
  });
}

async function loadMenuGroup(menuId, groupId, session) {
  const menu = await FoodMenu.findById(assertId(menuId, "รหัสเมนู"))
    .select("name restaurant optionGroups")
    .session(session)
    .lean();
  if (!menu) throw new OptionSetError("ไม่พบเมนู", 404);
  const gid = assertId(groupId, "รหัสกลุ่มตัวเลือก");
  const group = (menu.optionGroups || []).find((g) => sameId(g._id, gid));
  if (!group) throw new OptionSetError("ไม่พบกลุ่มตัวเลือกในเมนูนี้", 404);
  return { menu, group };
}

/** เลิกผูกกลุ่มจากชุด: กลายเป็นกลุ่มของเมนูเอง ค่าปัจจุบันคงเดิมทั้งหมด (_id เดิม) */
export async function detachGroupFromSet(menuId, groupId) {
  return inTransaction(async (session) => {
    const { menu, group } = await loadMenuGroup(menuId, groupId, session);
    if (!group.sourceSetId) throw new OptionSetError("กลุ่มนี้ไม่ได้ผูกกับชุดตัวเลือก", 400);
    const optionGroups = menu.optionGroups.map((g) => (sameId(g._id, group._id) ? detachGroup(g) : g));
    await FoodMenu.updateOne({ _id: menu._id }, { $set: { optionGroups } }, { session });
    return { menu: { id: String(menu._id), name: menu.name || "" }, groupId: String(group._id), setId: String(group.sourceSetId) };
  });
}

/** สร้างชุดจากกลุ่มของเมนูเอง แล้วผูกกลุ่มนั้นกับชุดใหม่ (_id ของกลุ่ม/ตัวเลือกในเมนูคงเดิม) */
export async function promoteGroupToSet(menuId, groupId, name) {
  await FoodOptionSet.init();
  try {
    return await inTransaction(async (session) => {
      const { menu, group } = await loadMenuGroup(menuId, groupId, session);
      if (group.sourceSetId) throw new OptionSetError("กลุ่มนี้ผูกกับชุดตัวเลือกอยู่แล้ว", 400);

      const choices = [...(group.choices || [])].sort(bySort);
      const setChoiceIds = choices.map(() => new ObjectId());
      const input = normalizeOptionSetInput({
        name: clean(name) || group.name,
        selectType: group.selectType,
        required: group.required,
        minSelect: group.minSelect ?? null,
        maxSelect: group.maxSelect ?? null,
        choices: choices.map((c) => ({ name: c.name, priceDelta: c.priceDelta, isActive: c.isActive })),
      });
      input.choices.forEach((c, i) => {
        c._id = setChoiceIds[i];
      });
      await assertNameFree(menu.restaurant, input.name, null, session);

      const [doc] = await FoodOptionSet.create([{ ...input, restaurant: menu.restaurant }], { session });
      const set = doc.toObject();

      const linked = materializeGroup(set, {
        _id: group._id,
        sortOrder: group.sortOrder,
        choices: choices.map((c, i) => ({ _id: c._id, sourceChoiceId: setChoiceIds[i] })),
      });
      const optionGroups = menu.optionGroups.map((g) => (sameId(g._id, group._id) ? linked : g));
      await FoodMenu.updateOne({ _id: menu._id }, { $set: { optionGroups } }, { session });

      // group (OS-3): the menu's group as now stored, so the wizard can show it as linked
      return {
        item: set,
        menu: { id: String(menu._id), name: menu.name || "" },
        groupId: String(group._id),
        group: linked,
      };
    });
  } catch (e) {
    if (isDuplicateKey(e)) throw new OptionSetError("มีชุดตัวเลือกชื่อนี้ในร้านนี้แล้ว", 409);
    throw e;
  }
}

/**
 * ลบชุด
 *   remove (default): ดึงกลุ่มที่ผูกชุดนี้ออกจากทุกเมนู
 *   detach: ทุกกลุ่มที่ผูกกลายเป็นกลุ่มของเมนูเอง (คง isActive ที่มีผลจริงตอนนี้ไว้)
 */
export async function deleteOptionSet(setId, mode = "remove") {
  const m = mode || "remove";
  if (!["remove", "detach"].includes(m)) throw new OptionSetError("mode ต้องเป็น remove หรือ detach", 400);

  return inTransaction(async (session) => {
    const set = await loadSet(setId, session);
    const menus = await linkedMenus(set._id, session);

    if (m === "remove") {
      await FoodMenu.updateMany(
        { "optionGroups.sourceSetId": set._id },
        { $pull: { optionGroups: { sourceSetId: set._id } } },
        { session },
      );
    } else {
      for (const menu of menus) {
        const optionGroups = menu.optionGroups.map((g) =>
          sameId(g.sourceSetId, set._id) ? detachGroup(g) : g,
        );
        await FoodMenu.updateOne({ _id: menu._id }, { $set: { optionGroups } }, { session });
      }
    }
    await FoodOptionSet.deleteOne({ _id: set._id }, { session });
    return { item: set, mode: m, menus: menus.map((x) => ({ id: String(x._id), name: x.name || "" })) };
  });
}

/* ---------------- menu POST / PUT ---------------- */

// group override keys equal to the set's own value are dropped (undefined when none left)
function sameAsSet(set, ov) {
  if (!ov) return undefined;
  const out = { ...ov };
  if (has(out, "required") && !!out.required === !!set.required) delete out.required;
  if (has(out, "minSelect") && (out.minSelect ?? null) === (set.minSelect ?? null)) delete out.minSelect;
  if (has(out, "maxSelect") && (out.maxSelect ?? null) === (set.maxSelect ?? null)) delete out.maxSelect;
  return Object.keys(out).length ? out : undefined;
}

/**
 * OS-3: what a menu save did to linked groups (for the audit log)
 *   attached = linked group that was not linked before · detached = same _id, now menu-only
 *   removed = linked group no longer in the menu
 */
export function linkedGroupChanges(beforeGroups, afterGroups) {
  const before = new Map(
    (beforeGroups || []).filter((g) => g?.sourceSetId).map((g) => [String(g._id), g]),
  );
  const afterById = new Map((afterGroups || []).map((g) => [String(g._id), g]));
  const row = (g, setId) => ({ groupId: String(g._id), setId: String(setId), name: g.name || "" });
  const attached = (afterGroups || [])
    .filter((g) => g?.sourceSetId && !before.has(String(g._id)))
    .map((g) => row(g, g.sourceSetId));
  const detached = [];
  const removed = [];
  for (const [id, g] of before) {
    const now = afterById.get(id);
    if (!now) removed.push(row(g, g.sourceSetId));
    else if (!now.sourceSetId) detached.push(row(g, g.sourceSetId));
  }
  return { attached, detached, removed };
}

/**
 * optionGroups จาก client ของ POST/PUT เมนู
 *   กลุ่มของเมนูเอง: normalizeOptionGroup แบบเดิม (+ minSelect/maxSelect)
 *   กลุ่มที่ผูกชุด (มี sourceSetId หรือ _id ตรงกับกลุ่มที่ผูกอยู่เดิม): สร้างใหม่จากชุดที่ server
 *     รับจาก client เฉพาะ overrides · hidden · overrides.priceDelta ของตัวเลือก · sortOrder
 *     key ที่ client ไม่ได้ส่ง = คงค่าเดิมของเมนู (wizard เดิมไม่รู้จัก field ใหม่ จึงไม่ทำให้หลุดผูก)
 *   existingGroups = optionGroups ปัจจุบันของเมนู ([] สำหรับเมนูใหม่)
 */
export async function resolveMenuOptionGroups({ raw, restaurantId, existingGroups = [] }) {
  if (!Array.isArray(raw)) throw new FoodMenuFieldError("optionGroups ต้องเป็น array");

  const prevLinked = new Map(
    (existingGroups || []).filter((g) => g?.sourceSetId).map((g) => [String(g._id), g]),
  );

  const plan = raw.map((g) => {
    const prev = g?._id ? prevLinked.get(clean(g._id)) || null : null;
    const setId = prev?.sourceSetId || (isId(g?.sourceSetId) ? clean(g.sourceSetId) : null);
    return { g, prev, setId: setId ? String(setId) : null };
  });

  const setIds = [...new Set(plan.filter((p) => p.setId).map((p) => p.setId))];
  const sets = setIds.length
    ? await FoodOptionSet.find({ _id: { $in: setIds.map((x) => new ObjectId(x)) } }).lean()
    : [];
  const setById = new Map(sets.map((s) => [String(s._id), s]));

  const used = new Set();
  return plan.map(({ g, prev, setId }, gi) => {
    // OS-3: detachFromSet = แยกเป็นของเมนูนี้ (ผลเดียวกับ route detach) — ค่าอื่นของกลุ่มนี้ใน payload ไม่ใช้รอบนี้
    if (g?.detachFromSet && prev) {
      const sortOrder = Number(g?.sortOrder);
      return { ...detachGroup(prev), sortOrder: Number.isFinite(sortOrder) ? sortOrder : gi };
    }
    if (!setId || g?.detachFromSet) return normalizeOptionGroup(g, gi);

    const set = setById.get(setId);
    if (!set) throw new FoodMenuFieldError(`ไม่พบชุดตัวเลือกของกลุ่มลำดับที่ ${gi + 1}`);
    if (!sameId(set.restaurant, restaurantId)) {
      throw new FoodMenuFieldError(`ชุดตัวเลือก "${set.name}" ไม่ได้อยู่ในร้านนี้`);
    }
    if (used.has(setId)) throw new FoodMenuFieldError(`ผูกชุดตัวเลือก "${set.name}" กับเมนูนี้ซ้ำไม่ได้`);
    used.add(setId);

    // ตัวเลือกเดิมของเมนู (key = sourceChoiceId) แล้วทับด้วยค่าที่ client ส่งมา
    const byEmbeddedId = new Map((prev?.choices || []).map((c) => [String(c._id), c]));
    const bySource = new Map(
      (prev?.choices || []).filter((c) => c.sourceChoiceId).map((c) => [String(c.sourceChoiceId), { ...c }]),
    );
    const setChoiceById = new Map((set.choices || []).map((c) => [String(c._id), c]));
    for (const rc of Array.isArray(g?.choices) ? g.choices : []) {
      const hit = byEmbeddedId.get(clean(rc?._id));
      const src = hit?.sourceChoiceId ? String(hit.sourceChoiceId) : clean(rc?.sourceChoiceId);
      if (!src || !setChoiceById.has(src)) continue;
      const cur = bySource.get(src) || { sourceChoiceId: src };
      if (has(rc, "hidden")) cur.hidden = !!rc.hidden;
      if (has(rc, "overrides")) cur.overrides = sanitizeChoiceOverrides(rc.overrides);
      bySource.set(src, cur);
    }
    // OS-3: override ที่เท่ากับค่าของชุด = ไม่ override (ตามชุดต่อไปเมื่อชุดเปลี่ยน)
    for (const [src, cur] of bySource) {
      const def = Number(setChoiceById.get(src)?.priceDelta) || 0;
      if (cur.overrides && Number(cur.overrides.priceDelta) === def) cur.overrides = undefined;
    }
    const groupOverrides = sameAsSet(
      set,
      has(g, "overrides") ? sanitizeGroupOverrides(g.overrides) : sanitizeGroupOverrides(prev?.overrides),
    );

    const sortOrder = Number(g?.sortOrder);
    const next = materializeGroup(set, {
      _id: prev?._id,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : gi,
      overrides: groupOverrides,
      choices: [...bySource.values()],
    });
    const err = materializedError(next);
    if (err) throw new FoodMenuFieldError(err);
    return next;
  });
}
