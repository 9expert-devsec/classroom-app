// src/lib/couponAllocation.js
// Client/server safe — no Node-only imports.
// Shared allocation algorithm for per-coupon applied amounts in a bill.

/**
 * Default face value when couponPrice is missing or invalid.
 */
export const DEFAULT_COUPON_FACE_VALUE = 180;

/**
 * Safely read a number, returning `fallback` if the value is missing or not finite.
 * @param {*} n
 * @param {number} fallback
 * @returns {number}
 */
function toAmount(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

/**
 * Read the face value from an item. Supports both flat shape
 * (`item.couponPrice`) and nested shape (`item.item.couponPrice`)
 * as used by RedeemBillDetailView rows.
 *
 * Callers that already have a flat list (e.g. DB docs) can pass
 * `{ couponPrice }` directly — the nested path is only checked
 * as a fallback.
 *
 * @param {object} item
 * @returns {number}
 */
function readFaceValue(item) {
  const direct = item?.couponPrice;
  if (direct != null && Number.isFinite(Number(direct))) {
    return Math.max(0, Number(direct));
  }
  const nested = item?.item?.couponPrice;
  if (nested != null && Number.isFinite(Number(nested))) {
    return Math.max(0, Number(nested));
  }
  return DEFAULT_COUPON_FACE_VALUE;
}

/**
 * Read redeemedAt as a timestamp for sorting.
 * Supports flat `item.redeemedAt` and nested `item.item.redeemedAt`.
 * @param {object} item
 * @returns {number} epoch ms, or 0 if missing
 */
function readRedeemedAt(item) {
  const raw = item?.redeemedAt ?? item?.item?.redeemedAt;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Read displayCode for tiebreak sorting.
 * Supports flat and nested shapes.
 * @param {object} item
 * @returns {string}
 */
function readDisplayCode(item) {
  return String(
    item?.displayCode ?? item?.item?.displayCode ?? item?.key ?? "",
  ).trim();
}

/**
 * Sort coupons within a bill for allocation.
 *
 * Business rule:
 * - Primary: `redeemedAt` ascending (earliest first).
 * - Tiebreak: `displayCode` alphabetic ascending.
 *
 * Returns a **new** sorted array — does NOT mutate input.
 *
 * @param {Array<object>} items - coupon items (flat or nested shape)
 * @returns {Array<object>} sorted copy
 */
export function sortCouponsForAllocation(items) {
  const list = Array.isArray(items) ? [...items] : [];

  list.sort((a, b) => {
    const at = readRedeemedAt(a);
    const bt = readRedeemedAt(b);
    if (at !== bt) return at - bt;

    const ak = readDisplayCode(a);
    const bk = readDisplayCode(b);
    return ak.localeCompare(bk, "en");
  });

  return list;
}

/**
 * Allocate bill amounts across an already-sorted list of coupons.
 *
 * For each coupon: `appliedAmount = min(faceValue, remainingBillTotal)`.
 * Coupons after the bill is fully covered get `appliedAmount = 0`.
 *
 * Returns a **new** array with each item annotated:
 * - `_order`          1-based position
 * - `_faceValue`      couponPrice (or DEFAULT_COUPON_FACE_VALUE)
 * - `_appliedAmount`  amount actually deducted
 * - `_remainingAfter` remaining bill total after this coupon
 *
 * Does NOT mutate input.
 *
 * @param {Array<object>} sortedItems - must already be sorted by sortCouponsForAllocation
 * @param {number} billTotal - total bill amount
 * @returns {Array<object>} annotated copy
 */
export function allocateBillAmounts(sortedItems, billTotal) {
  let remaining = Math.max(0, toAmount(billTotal, 0));

  return (Array.isArray(sortedItems) ? sortedItems : []).map((item, index) => {
    const faceValue = readFaceValue(item);
    const appliedAmount = Math.max(0, Math.min(faceValue, remaining));
    remaining = Math.max(0, remaining - appliedAmount);

    return {
      ...item,
      _order: index + 1,
      _faceValue: faceValue,
      _appliedAmount: appliedAmount,
      _remainingAfter: remaining,
    };
  });
}

/**
 * Convenience: sort + allocate in one call.
 *
 * @param {Array<object>} items - unsorted coupon items
 * @param {number} billTotal - total bill amount
 * @returns {Array<object>} sorted and annotated
 */
export function sortAndAllocate(items, billTotal) {
  return allocateBillAmounts(sortCouponsForAllocation(items), billTotal);
}
