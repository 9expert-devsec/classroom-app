// src/lib/couponCode.js
// Client/server safe — no Node-only imports.

// 32 chars — no 0, 1, I, O, L
export const COUPON_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const COUPON_CODE_PREFIX = "9XP";
export const COUPON_CODE_BODY_LENGTH = 4;
export const COUPON_CODE_TOTAL_LENGTH =
  COUPON_CODE_PREFIX.length + COUPON_CODE_BODY_LENGTH; // 7

// Regex for a VALID stored code (no separators).
export const COUPON_CODE_REGEX = /^9XP[23456789A-HJ-NP-Z]{4}$/;

/**
 * Normalize user/scanner input: trim, strip dashes + whitespace,
 * uppercase. Returns "" if not a valid code after normalization.
 */
export function normalizeCouponCode(input) {
  if (!input) return "";
  const cleaned = String(input).trim().replace(/[-\s]+/g, "").toUpperCase();
  return COUPON_CODE_REGEX.test(cleaned) ? cleaned : "";
}

/**
 * Format for display: "9XP5B23" -> "9XP-5B23". Idempotent.
 */
export function formatCouponCodeForDisplay(code) {
  if (!code) return "";
  const cleaned = String(code).trim().replace(/[-\s]+/g, "").toUpperCase();
  if (cleaned.length !== COUPON_CODE_TOTAL_LENGTH) return cleaned;
  return (
    cleaned.slice(0, COUPON_CODE_PREFIX.length) +
    cleaned.slice(COUPON_CODE_PREFIX.length)
  );
}

/**
 * Quick boolean check on a normalized code.
 */
export function isValidCouponCode(code) {
  return COUPON_CODE_REGEX.test(code);
}
