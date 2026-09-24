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
  };
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
  const next = { ...state, lines: [] };
  writeCart(token, next);
  return next;
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
 * เมนูเดิมที่ไม่มีตัวเลือกและไม่มีโน้ต -> บวก qty ในบรรทัดเดิม
 * อย่างอื่น -> บรรทัดใหม่
 */
export function addLine(state, { menuId, qty = 1, choices = [], note = "" }) {
  const lineKey = makeLineKey(menuId, choices, note);
  const lines = [...(state.lines || [])];
  const idx = lines.findIndex((l) => l.lineKey === lineKey);

  if (idx >= 0) {
    lines[idx] = { ...lines[idx], qty: (lines[idx].qty || 0) + qty };
  } else {
    lines.push({
      lineKey,
      menuId: String(menuId),
      qty,
      choices: normChoices(choices),
      note: String(note || "").trim(),
    });
  }
  return { ...state, lines };
}

export function setLineQty(state, lineKey, qty) {
  const lines = (state.lines || [])
    .map((l) => (l.lineKey === lineKey ? { ...l, qty } : l))
    .filter((l) => l.qty > 0);
  return { ...state, lines };
}

export function removeLine(state, lineKey) {
  return { ...state, lines: (state.lines || []).filter((l) => l.lineKey !== lineKey) };
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

  return { state: { ...state, lines: kept }, removed };
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
