// src/lib/optionGroupRules.js
//
// กติกาจำนวนตัวเลือกของ option group (OS-1) — pure ใช้ร่วมกันทั้ง
// FoodOptionSet, การบันทึกเมนู (foodMenuOptions / foodOptionSets) และการยืนยันออเดอร์ (lunchSubmit)
//   minSelect / maxSelect: null = ไม่จำกัด (ข้อมูลเดิมทั้งหมดเป็น null จึงผ่านเหมือนเดิม)
//   single  => maxSelect เป็น 1 หรือ null
//   minSelect <= maxSelect (single นับ max = 1)
//   required => min ที่มีผลจริง >= 1 (minSelect = 0 คู่กับบังคับเลือกถือว่าขัดกัน)

function has(o, k) {
  return !!o && Object.prototype.hasOwnProperty.call(o, k);
}

/** "" / null / undefined = null (ไม่จำกัด) · อย่างอื่นต้องเป็นจำนวนเต็มตั้งแต่ floor */
export function normalizeLimit(raw, floor) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < floor) return NaN;
  return n;
}

/** ข้อความ error (ภาษาไทย) หรือ null ถ้าถูกต้อง */
export function groupLimitsError({ name = "", selectType, required, minSelect, maxSelect }) {
  const label = name ? `กลุ่ม "${name}"` : "กลุ่มตัวเลือก";
  if (Number.isNaN(minSelect)) return `${label}: จำนวนขั้นต่ำต้องเป็นจำนวนเต็มตั้งแต่ 0`;
  if (Number.isNaN(maxSelect)) return `${label}: จำนวนสูงสุดต้องเป็นจำนวนเต็มตั้งแต่ 1`;

  const single = selectType !== "multi";
  if (single && maxSelect !== null && maxSelect !== undefined && maxSelect !== 1) {
    return `${label} เลือกได้ข้อเดียว — จำนวนสูงสุดต้องเป็น 1 หรือไม่จำกัด`;
  }
  const effMax = single ? 1 : maxSelect ?? null;
  if (minSelect !== null && minSelect !== undefined && effMax !== null && minSelect > effMax) {
    return `${label}: จำนวนขั้นต่ำต้องไม่มากกว่าจำนวนสูงสุด`;
  }
  if (required && minSelect === 0) {
    return `${label} บังคับเลือก — จำนวนขั้นต่ำต้องอย่างน้อย 1`;
  }
  return null;
}

/** ค่า required / min / max ที่มีผลจริงของกลุ่มที่ผูกชุด: override ของเมนูชนะค่าของชุด */
export function effectiveLimits(set, overrides) {
  const o = overrides || {};
  return {
    required: has(o, "required") ? !!o.required : !!set.required,
    minSelect: has(o, "minSelect") ? o.minSelect ?? null : set.minSelect ?? null,
    maxSelect: has(o, "maxSelect") ? o.maxSelect ?? null : set.maxSelect ?? null,
  };
}

/**
 * ตรวจจำนวนที่ผู้เรียนเลือกในกลุ่มเดียว (นอกเหนือจาก required/single ที่ lunchSubmit ตรวจอยู่แล้ว)
 *   minSelect มีผลเมื่อเลือกอย่างน้อย 1 ข้อ หรือกลุ่มบังคับเลือก
 *   (กลุ่มไม่บังคับ min 2 = ไม่เลือกเลยก็ได้ แต่ถ้าเลือกต้องครบ 2)
 * คืน { reason, message } หรือ null
 */
export function selectionCountError(group, count) {
  const name = group?.name || "";
  const min = group?.minSelect ?? null;
  const max = group?.maxSelect ?? null;
  if (min !== null && (count > 0 || group?.required) && count < min) {
    return { reason: "option_min", message: `"${name}" ต้องเลือกอย่างน้อย ${min} ข้อ` };
  }
  if (max !== null && count > max) {
    return { reason: "option_max", message: `"${name}" เลือกได้ไม่เกิน ${max} ข้อ` };
  }
  return null;
}
