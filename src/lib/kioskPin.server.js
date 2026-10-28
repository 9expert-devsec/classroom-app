// src/lib/kioskPin.server.js
//
// PIN-P1: 6-digit kiosk PIN per admin account (Node runtime only).
//
//   KIOSK_PIN_SECRET (32 random bytes, base64) -> HKDF-SHA256 subkeys:
//     "kiosk-pin-hmac-v1" -> kioskPinHmac = HMAC-SHA256(key, "kiosk-pin-v1:" + pin) hex
//                            deterministic: unique index + lookup key at the kiosk (P2)
//     "kiosk-pin-enc-v1"  -> kioskPinEnc  = AES-256-GCM, base64(iv12 | tag16 | ciphertext)
//                            so the owner can see their own PIN again (not show-once)
//   No fallback to JWT_SECRET: rotating KIOSK_PIN_SECRET invalidates every PIN.
//
// Never log or return the PIN, hmac or ciphertext except revealPin's caller
// (the owner's own /reveal) and setNewPin's caller (the owner's own regenerate).
import crypto from "node:crypto";
import dbConnect from "@/lib/mongoose";
import AdminUser from "@/models/AdminUser";
import { buildPermSet, PERM } from "@/lib/acl";

const HMAC_INFO = "kiosk-pin-hmac-v1";
const ENC_INFO = "kiosk-pin-enc-v1";
const HMAC_PREFIX = "kiosk-pin-v1:";
const SECRET_MIN_BYTES = 32;

export const PIN_ATTEMPTS = 10;

export class PinUnavailableError extends Error {
  constructor() {
    super("Kiosk PIN is not configured");
    this.name = "PinUnavailableError";
    this.status = 500;
    this.reason = "pin_unavailable";
  }
}

let keys = null;

function secretBytes() {
  const raw = String(process.env.KIOSK_PIN_SECRET || "").trim();
  if (!raw) return null;
  const buf = Buffer.from(raw, "base64");
  return buf.length >= SECRET_MIN_BYTES ? buf : null;
}

/** true when KIOSK_PIN_SECRET is set and decodes to >= 32 bytes */
export function isPinConfigured() {
  return !!secretBytes();
}

function getKeys() {
  if (keys) return keys;
  const ikm = secretBytes();
  if (!ikm) throw new PinUnavailableError();
  const salt = Buffer.alloc(0);
  keys = {
    hmac: Buffer.from(crypto.hkdfSync("sha256", ikm, salt, HMAC_INFO, 32)),
    enc: Buffer.from(crypto.hkdfSync("sha256", ikm, salt, ENC_INFO, 32)),
  };
  return keys;
}

export function isPinShape(s) {
  return /^\d{6}$/.test(String(s ?? ""));
}

export function pinHmac(pin) {
  return crypto
    .createHmac("sha256", getKeys().hmac)
    .update(HMAC_PREFIX + String(pin))
    .digest("hex");
}

export function encryptPin(pin) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKeys().enc, iv);
  const enc = Buffer.concat([cipher.update(String(pin), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

/** Throws when the payload was tampered with or made with another secret. */
export function decryptPin(payload) {
  const raw = Buffer.from(String(payload || ""), "base64");
  if (raw.length < 12 + 16 + 1) throw new Error("Invalid PIN payload");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKeys().enc, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

/** all one digit, or a straight run up/down (012345, 123456, 987654, 543210 …) */
export function isTrivialPin(pin) {
  const d = String(pin).split("").map(Number);
  const steps = d.slice(1).map((x, i) => x - d[i]);
  return steps.every((s) => s === 0) || steps.every((s) => s === 1) || steps.every((s) => s === -1);
}

/** `draw` is for tests only (forces specific values); production uses randomInt. */
export function generatePin(draw = () => crypto.randomInt(0, 1_000_000)) {
  for (;;) {
    const pin = String(draw()).padStart(6, "0");
    if (!isTrivialPin(pin)) return pin;
  }
}

function isPinCollision(err) {
  const e = err?.code === 11000 ? err : err?.cause?.code === 11000 ? err.cause : null;
  if (!e) return false;
  if (e.keyPattern && typeof e.keyPattern === "object") return "kioskPinHmac" in e.keyPattern;
  if (e.keyValue && typeof e.keyValue === "object") return "kioskPinHmac" in e.keyValue;
  return /index:\s*kioskPinHmac_unique\b/.test(String(e.errmsg || e.message || ""));
}

/**
 * New PIN for userId (replaces any old one at once). Returns { pin, setAt },
 * or null when the account does not exist. Retries on a PIN collision with
 * another account (unique index), like couponCodeRetry.server.js.
 */
export async function setNewPin(userId, byId) {
  getKeys();
  await dbConnect();
  for (let attempt = 1; ; attempt += 1) {
    const pin = generatePin();
    const setAt = new Date();
    try {
      const r = await AdminUser.updateOne(
        { _id: userId },
        {
          $set: {
            kioskPinHmac: pinHmac(pin),
            kioskPinEnc: encryptPin(pin),
            kioskPinSetAt: setAt,
            kioskPinSetBy: byId || null,
          },
        },
      );
      if (!r.matchedCount) return null;
      return { pin, setAt };
    } catch (err) {
      if (!isPinCollision(err)) throw err;
      console.warn(`[kioskPin] PIN collision (attempt ${attempt}/${PIN_ATTEMPTS})`);
      if (attempt >= PIN_ATTEMPTS) throw new Error("สร้าง PIN ไม่สำเร็จ กรุณาลองใหม่");
    }
  }
}

/** The owner's current PIN, or null when there is none. */
export async function revealPin(userId) {
  getKeys();
  await dbConnect();
  const u = await AdminUser.findById(userId).select("+kioskPinEnc").lean();
  if (!u?.kioskPinEnc) return null;
  return decryptPin(u.kioskPinEnc);
}

/** Remove the PIN. Returns true when the account had one. */
export async function clearPin(userId) {
  await dbConnect();
  const r = await AdminUser.updateOne(
    { _id: userId, kioskPinSetAt: { $ne: null } },
    { $set: { kioskPinHmac: null, kioskPinEnc: null, kioskPinSetAt: null, kioskPinSetBy: null } },
  );
  return r.modifiedCount > 0;
}

/**
 * P2 (kiosk login): the active account whose PIN this is and that may open a
 * kiosk, or null. Unused in P1.
 */
export async function findUserByPin(pin) {
  if (!isPinShape(pin)) return null;
  const hmac = pinHmac(pin);
  await dbConnect();
  const user = await AdminUser.findOne({ kioskPinHmac: hmac, isActive: true });
  if (!user) return null;
  const roleCode = String(user.roleCode || "OPS").toUpperCase();
  return buildPermSet(roleCode, user.extraPerms || []).has(PERM.CLASSROOM_OPERATE) ? user : null;
}
