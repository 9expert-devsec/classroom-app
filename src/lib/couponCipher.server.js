// src/lib/couponCipher.server.js
import crypto from "crypto";

function mustKey() {
  const k = process.env.COUPON_CIPHER_KEY; // base64 32 bytes
  if (!k) throw new Error("Missing COUPON_CIPHER_KEY");
  const buf = Buffer.from(k, "base64");
  if (buf.length !== 32)
    throw new Error("COUPON_CIPHER_KEY must be 32 bytes base64");
  return buf;
}

export function makeRandomToken(bytes = 18) {
  return crypto.randomBytes(bytes).toString("base64url"); // token raw
}

export function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

export function encryptCipher(text) {
  const key = mustKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([
    cipher.update(String(text), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptCipher(payload) {
  const key = mustKey();
  const raw = Buffer.from(String(payload), "base64url");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}
