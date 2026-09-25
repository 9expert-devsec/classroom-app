// src/lib/kioskToken.js
//
// Kiosk session token for /classroom tablets (L2a).
//
// Edge-safe: used by src/middleware.js as well as by Node route handlers, so
// only jose + Web Crypto here - no DB, no Node-only APIs.
//
// The signing key is DERIVED from JWT_SECRET (HMAC-SHA256 of a fixed label),
// never JWT_SECRET itself. Together with the typ claim this means an admin
// token can never pass as a kiosk token and vice versa.
import { SignJWT, jwtVerify } from "jose";
import { getJwtSecretBytes } from "@/utils/auth";

export const KIOSK_COOKIE_NAME = "kiosk_token";

const KEY_LABEL = "classroom-kiosk-v1";

let keyPromise = null;

/** HMAC-SHA256(JWT_SECRET, "classroom-kiosk-v1") as raw key bytes. */
export function deriveKioskKey() {
  if (!keyPromise) {
    keyPromise = (async () => {
      const hmacKey = await crypto.subtle.importKey(
        "raw",
        getJwtSecretBytes(),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const bits = await crypto.subtle.sign(
        "HMAC",
        hmacKey,
        new TextEncoder().encode(KEY_LABEL),
      );
      return new Uint8Array(bits);
    })().catch((e) => {
      keyPromise = null;
      throw e;
    });
  }
  return keyPromise;
}

/** JWT { typ: "kiosk", sid } that expires exactly at expiresAt. */
export async function signKioskToken(sid, expiresAt) {
  const key = await deriveKioskKey();
  const exp = Math.floor(new Date(expiresAt).getTime() / 1000);

  return new SignJWT({ typ: "kiosk", sid: String(sid) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(key);
}

/** { sid, exp } for a valid kiosk token; throws otherwise. */
export async function verifyKioskToken(token) {
  const key = await deriveKioskKey();
  const { payload } = await jwtVerify(String(token || ""), key, {
    algorithms: ["HS256"],
  });

  if (payload?.typ !== "kiosk") throw new Error("Not a kiosk token");
  const sid = typeof payload.sid === "string" ? payload.sid : "";
  if (!sid) throw new Error("Kiosk token without sid");

  return { sid, exp: payload.exp };
}

/** Cookie options - same flags as the admin cookie, lives until expiresAt. */
export function kioskCookieOptions(expiresAt) {
  const secs = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000);
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(0, secs),
  };
}

/**
 * Where to go after the kiosk login. Only a relative /classroom path (with an
 * optional query) is accepted; anything else - other paths, "//host",
 * backslashes, schemes, the login page itself - falls back to /classroom.
 */
export function safeKioskNext(raw) {
  const s = String(raw || "");
  if (!/^\/classroom(?:[/?#]|$)/.test(s)) return "/classroom";
  if (s.includes("//") || s.includes("\\")) return "/classroom";
  if (/[\u0000-\u001f\u007f]/.test(s)) return "/classroom";
  if (/^\/classroom\/login(?:[/?#]|$)/.test(s)) return "/classroom";
  return s;
}
