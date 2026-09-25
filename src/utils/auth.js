// src/utils/auth.js
import { SignJWT, jwtVerify } from "jose";

// Raw JWT_SECRET bytes. Also the input the kiosk token key is derived from
// (src/lib/kioskToken.js), so both keys follow the same fallback rules.
export function getJwtSecretBytes() {
  return getSecret();
}

function getSecret() {
  const raw = String(process.env.JWT_SECRET || "").trim();
  if (!raw && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
  const s = raw || "dev-jwt-secret";
  return new TextEncoder().encode(s);
}

function getExpires() {
  const v = String(process.env.JWT_EXPIRES_IN || "").trim();
  // jose รับ format แบบ "7d", "12h", "30m" ฯลฯ
  return v || "7d";
}

export async function signAdminToken(payload) {
  const secret = getSecret();
  const exp = getExpires();

  // typ: "admin" keeps admin and kiosk tokens from being mistaken for each other
  return new SignJWT({ ...payload, typ: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret);
}

export async function verifyAdminToken(token) {
  const secret = getSecret();
  const { payload } = await jwtVerify(token, secret);
  // tokens issued before typ existed have none and are still admin tokens
  if (payload?.typ !== undefined && payload.typ !== "admin") {
    throw new Error("Not an admin token");
  }
  return payload;
}
