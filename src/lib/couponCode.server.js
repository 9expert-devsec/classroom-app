// src/lib/couponCode.server.js
import crypto from "crypto";
import {
  COUPON_CODE_ALPHABET,
  COUPON_CODE_PREFIX,
  COUPON_CODE_BODY_LENGTH,
} from "./couponCode";

export function generateCouponCode() {
  const A = COUPON_CODE_ALPHABET; // 32 chars; 256 % 32 === 0 -> no modulo bias
  const LEN = COUPON_CODE_BODY_LENGTH;
  const bytes = crypto.randomBytes(LEN);
  let body = "";
  for (let i = 0; i < LEN; i++) body += A[bytes[i] % A.length];
  return COUPON_CODE_PREFIX + body;
}
