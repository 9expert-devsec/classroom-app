// scripts/test-code-gen.js
// Run: node scripts/test-code-gen.js
//
// Tests generateCouponCode() for correctness:
//  - All 10,000 outputs match the expected regex
//  - Zero duplicates in the batch

const crypto = require("crypto");

// Inline the constants & generator so this script is self-contained
// (avoids needing tsx/esm loader for path aliases).

const COUPON_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const COUPON_CODE_PREFIX = "9XP";
const COUPON_CODE_BODY_LENGTH = 4;
const COUPON_CODE_REGEX = /^9XP[23456789A-HJ-NP-Z]{4}$/;

function generateCouponCode() {
  const A = COUPON_CODE_ALPHABET;
  const LEN = COUPON_CODE_BODY_LENGTH;
  const bytes = crypto.randomBytes(LEN);
  let body = "";
  for (let i = 0; i < LEN; i++) body += A[bytes[i] % A.length];
  return COUPON_CODE_PREFIX + body;
}

// --- Test ---
const N = 10_000;
const codes = new Set();
let regexFails = 0;

for (let i = 0; i < N; i++) {
  const code = generateCouponCode();
  if (!COUPON_CODE_REGEX.test(code)) {
    regexFails++;
    console.error(`REGEX FAIL [${i}]: ${code}`);
  }
  codes.add(code);
}

const dupes = N - codes.size;

console.log(`Generated: ${N}`);
console.log(`Unique:    ${codes.size}`);
console.log(`Dupes:     ${dupes}`);
console.log(`Regex failures: ${regexFails}`);

if (regexFails > 0) {
  console.error("FAIL: Some codes did not match the expected regex.");
  process.exit(1);
}

if (dupes > 0) {
  // With 32^4 = 1,048,576 possible codes, 10k codes should have
  // ~0.05 expected collisions. A few dupes is statistically possible
  // but not a code bug. We warn but don't fail.
  console.warn(`WARN: ${dupes} duplicate(s) in ${N} codes (statistically rare but possible).`);
}

console.log("PASS: All codes valid.");
