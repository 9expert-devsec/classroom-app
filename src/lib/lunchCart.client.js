"use client";

// src/lib/lunchCart.client.js
//
// ตะกร้าของผู้เรียน เก็บใน localStorage ต่อ 1 token
//
// กติกาสำคัญ: ห้ามเก็บ "ราคา" ลง storage เด็ดขาด
// ราคาคิดใหม่จากเมนู DTO ปัจจุบันเสมอ (price + priceDelta) × qty
// เพราะแอดมินแก้ราคาได้ตลอด และ server คิดราคาเองอยู่แล้วตอน submit

const VERSION = "lunch:v1";

export function storageKey(token) {
  return `${VERSION}:${token}`;
}

function emptyState() {
  return {
    nickname: "",
    nicknameConfirmed: false,
    restaurantId: "",
    lines: [],
    // requestId ของการ submit ครั้งนี้ — กดซ้ำ / reload / เน็ตหลุดแล้วลองใหม่
    // ใช้ id เดิม ส่วนการแก้เนื้อหาตะกร้าทุกครั้งจะล้างทิ้ง (ดู withContent)
    requestId: "",
  };
}

export const MIN_QTY = 1;
export const MAX_QTY = 20;
export const MAX_NOTE = 200;

const clampQty = (q) =>
  Math.min(MAX_QTY, Math.max(MIN_QTY, Math.round(Number(q) || MIN_QTY)));

/* ---------------- request id ---------------- */

/**
 * UUID สำหรับ requestId ของการ submit
 * crypto.randomUUID มีเฉพาะ secure context (HTTPS / localhost) เท่านั้น
 * เปิดผ่าน http://192.168.x.x บนมือถือจะไม่มี -> สร้าง v4 เองจาก
 * crypto.getRandomValues ซึ่งใช้ได้ทุก context
 */
export function newRequestId() {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();

  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/* ---------------- read / write (ทุกอันกัน throw) ---------------- */

export function readCart(token) {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(storageKey(token));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return {
      nickname: String(parsed?.nickname || ""),
      nicknameConfirmed: !!parsed?.nicknameConfirmed,
      restaurantId: String(parsed?.restaurantId || ""),
      lines: Array.isArray(parsed?.lines) ? parsed.lines : [],
      requestId: String(parsed?.requestId || ""),
    };
  } catch {
    // storage เต็ม / ปิดอยู่ / JSON เสีย -> เริ่มใหม่แบบว่าง ๆ ดีกว่าพัง
    return emptyState();
  }
}

export function writeCart(token, state) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(token), JSON.stringify(state));
  } catch {
    // เขียนไม่ได้ก็ปล่อยไป หน้าจอยังทำงานต่อได้จาก state ใน memory
  }
}

export function clearCartLines(token, state) {
  const next = { ...state, lines: [], requestId: "" };
  writeCart(token, next);
  return next;
}

/** เนื้อหาตะกร้าเปลี่ยน = คำสั่งซื้อใหม่ -> requestId เดิมใช้ไม่ได้แล้ว */
function withContent(state, patch) {
  return { ...state, ...patch, requestId: "" };
}

/** เปลี่ยนร้าน: ล้างรายการ + requestId */
export function switchRestaurant(state, restaurantId) {
  return withContent(state, { restaurantId: String(restaurantId || ""), lines: [] });
}

/** requestId ที่จะใช้ submit — มีอยู่แล้วใช้ของเดิม ไม่มีค่อยสร้าง */
export function ensureRequestId(state) {
  if (state.requestId) return state;
  return { ...state, requestId: newRequestId() };
}

/* ---------------- line identity ---------------- */

function normChoices(choices) {
  return (Array.isArray(choices) ? choices : [])
    .map((c) => ({
      groupId: String(c?.groupId || ""),
      choiceIds: [...(Array.isArray(c?.choiceIds) ? c.choiceIds : [])]
        .map(String)
        .sort(),
    }))
    .filter((c) => c.groupId && c.choiceIds.length > 0)
    .sort((a, b) => a.groupId.localeCompare(b.groupId));
}

/** กุญแจของบรรทัด: เมนูเดียวกัน + ตัวเลือกเดียวกัน + โน้ตเดียวกัน = บรรทัดเดียวกัน */
export function makeLineKey(menuId, choices, note) {
  const c = normChoices(choices)
    .map((g) => `${g.groupId}:${g.choiceIds.join(",")}`)
    .join("|");
  return `${menuId}#${c}#${String(note || "").trim()}`;
}

/* ---------------- mutations ---------------- */

/**
 * เพิ่มลงตะกร้า
 * รวมเข้าบรรทัดเดิมก็ต่อเมื่อ เมนู + ชุดตัวเลือก (ไม่สนลำดับ) + โน้ตที่ trim แล้ว
 * ตรงกันทั้งหมด (= lineKey เดียวกัน) นอกนั้นเป็นบรรทัดใหม่
 * qty ต่อบรรทัดไม่เกิน MAX_QTY เท่ากับที่ server ยอมรับ
 */
export function addLine(state, { menuId, qty = 1, choices = [], note = "" }) {
  const lineKey = makeLineKey(menuId, choices, note);
  const lines = [...(state.lines || [])];
  const idx = lines.findIndex((l) => l.lineKey === lineKey);

  if (idx >= 0) {
    lines[idx] = { ...lines[idx], qty: clampQty((lines[idx].qty || 0) + qty) };
  } else {
    lines.push({
      lineKey,
      menuId: String(menuId),
      qty: clampQty(qty),
      choices: normChoices(choices),
      note: String(note || "").trim(),
    });
  }
  return withContent(state, { lines });
}

/** ปรับจำนวน — ขั้นต่ำ 1 เสมอ การลบบรรทัดทำได้ทาง removeLine เท่านั้น */
export function setLineQty(state, lineKey, qty) {
  const lines = (state.lines || []).map((l) =>
    l.lineKey === lineKey ? { ...l, qty: clampQty(qty) } : l,
  );
  return withContent(state, { lines });
}

export function removeLine(state, lineKey) {
  return withContent(state, {
    lines: (state.lines || []).filter((l) => l.lineKey !== lineKey),
  });
}

/* ---------------- reconcile + totals ---------------- */

/**
 * ตัดบรรทัดที่ใช้ไม่ได้แล้วออก:
 *   - เมนูหายไปจาก DTO
 *   - เมนูหมดวันนี้
 *   - เมนูเป็นของร้านอื่น (เพราะ menus ที่ส่งมาเป็นของร้านเดียว)
 * คืน { state, removed } เพื่อให้หน้าจอขึ้นข้อความแจ้งได้
 */
export function reconcile(state, menus) {
  const byId = new Map((menus || []).map((m) => [String(m.id), m]));
  const kept = [];
  let removed = 0;

  for (const l of state.lines || []) {
    const m = byId.get(String(l.menuId));
    if (!m || m.unavailableToday || m.price === null || m.price === undefined) {
      removed += 1;
      continue;
    }
    kept.push(l);
  }

  if (removed === 0) return { state, removed };
  return { state: withContent(state, { lines: kept }), removed };
}

/** ชื่อตัวเลือกที่เลือกไว้ เรียงตามกลุ่มและตัวเลือกใน DTO */
export function choiceNamesOf(line, menu) {
  if (!menu) return [];
  const picked = new Map(
    (line.choices || []).map((g) => [String(g.groupId), new Set((g.choiceIds || []).map(String))]),
  );
  const names = [];
  for (const group of menu.optionGroups || []) {
    const ids = picked.get(String(group.id));
    if (!ids) continue;
    for (const c of group.choices || []) {
      if (ids.has(String(c.id))) names.push(c.name);
    }
  }
  return names;
}

/** ราคาต่อหน่วยของบรรทัด = ราคาเมนู + priceDelta ของตัวเลือกที่เลือก */
export function unitPriceOf(line, menu) {
  if (!menu) return 0;
  let price = Number(menu.price) || 0;

  for (const g of line.choices || []) {
    const group = (menu.optionGroups || []).find(
      (x) => String(x.id) === String(g.groupId),
    );
    if (!group) continue;
    for (const cid of g.choiceIds || []) {
      const choice = (group.choices || []).find(
        (c) => String(c.id) === String(cid),
      );
      if (choice) price += Number(choice.priceDelta) || 0;
    }
  }
  return price;
}

export function cartTotals(state, menus) {
  const byId = new Map((menus || []).map((m) => [String(m.id), m]));
  let count = 0;
  let total = 0;

  for (const l of state.lines || []) {
    const m = byId.get(String(l.menuId));
    if (!m) continue;
    count += l.qty || 0;
    total += unitPriceOf(l, m) * (l.qty || 0);
  }
  return { count, total };
}

/** เมนูนี้กด "+" เพิ่มเลยได้ไหม (ไม่มีกลุ่มตัวเลือกที่บังคับ) */
export function canQuickAdd(menu) {
  if (!menu) return false;
  if (menu.unavailableToday) return false;
  return !(menu.optionGroups || []).some((g) => g.required);
}
