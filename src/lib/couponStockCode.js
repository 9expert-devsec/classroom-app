// src/lib/couponStockCode.js
// กติกาของรหัสคูปอง stock ที่ต้องเหมือนกันทั้ง client (ตัวนับสด) และ server (import)
// ไฟล์นี้ใช้ได้ทั้ง client และ server — ห้าม import อะไรที่เป็น Node-only / model

// ตัดช่องว่างทั้งหมด (รวมที่แปะมาจาก Excel) แล้วทำเป็นตัวใหญ่
export function normalizeStockCode(raw) {
  return String(raw ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

export const STOCK_CODE_REGEX = /^[A-Z0-9-]{4,40}$/;

export function isValidStockCode(raw) {
  return STOCK_CODE_REGEX.test(normalizeStockCode(raw));
}

// จำนวนรหัสสูงสุดต่อการนำเข้า 1 ครั้ง
export const MAX_IMPORT_CODES = 2000;

export const MAX_IMPORT_NOTE = 500;

// แยกข้อความที่วางมาเป็นบรรทัด (ตัดบรรทัดว่างทิ้ง)
export function splitStockCodeLines(text) {
  return String(text || "")
    .split(/[\r\n,;\t]+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * จัดกลุ่มทีละบรรทัดตามลำดับที่วางมา (ไม่แตะ DB)
 *   ok        : รูปแบบผ่าน และเป็นครั้งแรกที่เจอ
 *   duplicate : ซ้ำกันเองในข้อความที่วาง (ครั้งแรกนับเป็น ok)
 *   invalid   : รูปแบบไม่ผ่าน
 */
export function classifyLinesLocal(text) {
  const lines = splitStockCodeLines(text);
  const seen = new Set();
  const rows = lines.map((raw) => {
    const code = normalizeStockCode(raw);
    if (!STOCK_CODE_REGEX.test(code)) return { raw, code, result: "invalid" };
    if (seen.has(code)) return { raw, code, result: "duplicate" };
    seen.add(code);
    return { raw, code, result: "ok" };
  });
  return { lines, rows };
}
