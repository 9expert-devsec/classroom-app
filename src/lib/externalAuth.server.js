// src/lib/externalAuth.server.js
//
// Authentication and guardrails for the read-only external API under
// /api/ext/v1. Partners authenticate with an API key sent as `x-api-key`
// (or `Authorization: Bearer <key>`). The raw key is shown exactly once at
// creation time and is never stored, logged, or echoed back afterwards.
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import ExternalApiKey from "@/models/ExternalApiKey";
import { getBaseUrl } from "@/lib/baseUrl.server";

const KEY_PREFIX = "9xc_live_";
const KEY_RANDOM_BYTES = 32;
const PREFIX_VISIBLE_CHARS = 8;

function clean(x) {
  return String(x ?? "").trim();
}

/* ---------------- key generation / hashing ---------------- */

/**
 * Mint a new API key.
 * Returns { raw, prefix, hash }. `raw` is the ONLY time the full key exists -
 * hand it to the caller once and never persist it.
 */
export function generateApiKey() {
  const random = crypto.randomBytes(KEY_RANDOM_BYTES).toString("base64url");
  const raw = `${KEY_PREFIX}${random}`;

  return {
    raw,
    prefix: `${KEY_PREFIX}${random.slice(0, PREFIX_VISIBLE_CHARS)}`,
    hash: hashApiKey(raw),
  };
}

export function hashApiKey(raw) {
  return crypto.createHash("sha256").update(String(raw ?? "")).digest("hex");
}

/** Constant-time comparison of two hex digests of equal length. */
function safeEqualHex(a, b) {
  const bufA = Buffer.from(String(a ?? ""), "utf8");
  const bufB = Buffer.from(String(b ?? ""), "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/* ---------------- request helpers ---------------- */

/** Extract the presented key from x-api-key, falling back to a Bearer token. */
function readPresentedKey(req) {
  const direct = clean(req?.headers?.get?.("x-api-key"));
  if (direct) return direct;

  const auth = clean(req?.headers?.get?.("authorization"));
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m ? clean(m[1]) : "";
}

/**
 * Client IP, resolved in trust order. Returns "" when no TRUSTED source yields
 * an address - callers must treat "" as "unknown", never as "allowed".
 *
 * Why not x-forwarded-for[0]: on Vercel a caller may send their own
 * x-forwarded-for and the platform APPENDS the real client IP to it, so entry
 * [0] is attacker-supplied. It is only trustworthy when nothing upstream can
 * inject it, i.e. local development.
 *
 *   1. x-vercel-forwarded-for - set by Vercel's edge, not client-settable
 *   2. req.ip                 - populated by the runtime, when available
 *   3. x-real-ip              - set by the platform/reverse proxy
 *   4. x-forwarded-for[0]     - LOCAL DEV ONLY, gated on !process.env.VERCEL
 */
export function clientIpFrom(req) {
  const vercelFwd = clean(req?.headers?.get?.("x-vercel-forwarded-for"));
  if (vercelFwd) return clean(vercelFwd.split(",")[0]);

  const runtimeIp = clean(req?.ip);
  if (runtimeIp) return runtimeIp;

  const realIp = clean(req?.headers?.get?.("x-real-ip"));
  if (realIp) return realIp;

  // Spoofable. Never consulted on Vercel.
  if (!clean(process.env.VERCEL)) {
    const fwd = clean(req?.headers?.get?.("x-forwarded-for"));
    if (fwd) return clean(fwd.split(",")[0]);
  }

  return "";
}

/* ---------------- error envelope ---------------- */

/**
 * Uniform error body for every external endpoint:
 *   { ok: false, error: { code, message, ...extra } }
 */
export function externalError(status, code, message, extra = {}) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(extra || {}) } },
    { status },
  );
}

/* ---------------- CORS ---------------- */

/**
 * CORS headers for a request. The request Origin is echoed only when it is an
 * exact match in the key's allowedOrigins; an empty allowedOrigins means the
 * key is not usable from a browser at all (server-to-server only).
 */
export function corsHeadersFor(req, keyDoc) {
  const headers = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "x-api-key,authorization,content-type",
    "Access-Control-Max-Age": "600",
  };

  const origin = clean(req?.headers?.get?.("origin"));
  const allowed = Array.isArray(keyDoc?.allowedOrigins)
    ? keyDoc.allowedOrigins.map(clean).filter(Boolean)
    : [];

  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

/* ---------------- rate limiting ---------------- */

// Best-effort sliding window kept in module memory.
//
// IMPORTANT: this is PER SERVERLESS INSTANCE. On Vercel each concurrent lambda
// has its own copy, so the real ceiling is roughly rateLimitPerMin x number of
// warm instances. Treat it as advisory back-pressure against runaway clients,
// NOT as a security control or a billing-grade quota.
const RATE_WINDOW_MS = 60 * 1000;
const RATE_SWEEP_EVERY = 50;
const rateBuckets = new Map();
let rateCallsSinceSweep = 0;

/**
 * Drop every bucket whose window has fully expired. Without this the Map grows
 * once per key seen and never shrinks, leaking memory on a long-lived instance.
 */
function sweepRateBuckets(cutoff) {
  for (const [id, hits] of rateBuckets) {
    const live = hits.filter((t) => t > cutoff);
    if (live.length) rateBuckets.set(id, live);
    else rateBuckets.delete(id);
  }
}

export function checkRateLimit(keyDoc) {
  const limit = Number(keyDoc?.rateLimitPerMin);
  if (!Number.isFinite(limit) || limit <= 0) return { ok: true, retryAfter: 0 };

  const id = String(keyDoc?._id || "");
  if (!id) return { ok: true, retryAfter: 0 };

  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;

  // Cheap amortised prune so expired buckets cannot accumulate.
  rateCallsSinceSweep += 1;
  if (rateCallsSinceSweep >= RATE_SWEEP_EVERY) {
    rateCallsSinceSweep = 0;
    sweepRateBuckets(cutoff);
  }

  const hits = (rateBuckets.get(id) || []).filter((t) => t > cutoff);

  if (hits.length >= limit) {
    rateBuckets.set(id, hits);
    const retryAfter = Math.max(
      1,
      Math.ceil((hits[0] + RATE_WINDOW_MS - now) / 1000),
    );
    return { ok: false, retryAfter };
  }

  hits.push(now);
  rateBuckets.set(id, hits);

  // Hard backstop in case many distinct keys arrive between sweeps.
  if (rateBuckets.size > 500) sweepRateBuckets(cutoff);

  return { ok: true, retryAfter: 0 };
}

/* ---------------- authentication ---------------- */

/**
 * Authenticate an external request.
 * Resolves { ok: true, keyDoc } or { ok: false, status, code, message }.
 * Never throws for auth failures - callers turn the result into externalError().
 */
export async function authenticateExternalRequest(req, { scope } = {}) {
  const presented = readPresentedKey(req);
  if (!presented) {
    return {
      ok: false,
      status: 401,
      code: "unauthorized",
      message: "Invalid or missing API key",
    };
  }

  await dbConnect();

  const hash = hashApiKey(presented);
  const keyDoc = await ExternalApiKey.findOne({ keyHash: hash });

  // Same generic response for "no such key" and "hash mismatch" so the error
  // never tells a caller whether a key exists.
  if (!keyDoc || !safeEqualHex(keyDoc.keyHash, hash)) {
    return {
      ok: false,
      status: 401,
      code: "unauthorized",
      message: "Invalid or missing API key",
    };
  }

  if (keyDoc.revokedAt) {
    return {
      ok: false,
      status: 401,
      code: "key_revoked",
      message: "This API key has been revoked",
    };
  }

  if (keyDoc.expiresAt && new Date(keyDoc.expiresAt).getTime() < Date.now()) {
    return {
      ok: false,
      status: 401,
      code: "key_expired",
      message: "This API key has expired",
    };
  }

  const scopes = Array.isArray(keyDoc.scopes) ? keyDoc.scopes : [];
  if (scope && !scopes.includes(scope)) {
    return {
      ok: false,
      status: 403,
      code: "scope_denied",
      message: `This API key does not have the "${scope}" scope`,
    };
  }

  const allowedIps = (Array.isArray(keyDoc.allowedIps) ? keyDoc.allowedIps : [])
    .map(clean)
    .filter(Boolean);
  const ip = clientIpFrom(req);

  // Fail closed: an unknown IP is NOT an allowed IP. If no trusted source gave
  // us an address, a key with an allow-list must be rejected rather than let
  // through on the assumption that the restriction does not apply.
  if (allowedIps.length && (!ip || !allowedIps.includes(ip))) {
    return {
      ok: false,
      status: 403,
      code: "ip_not_allowed",
      message: "This API key is not allowed from this IP address",
    };
  }

  // Usage bookkeeping is fire-and-forget: it must not add latency to, or be
  // able to fail, the response path.
  ExternalApiKey.updateOne(
    { _id: keyDoc._id },
    {
      $set: { lastUsedAt: new Date(), lastUsedIp: ip },
      $inc: { requestCount: 1 },
    },
  )
    .exec()
    .catch((err) => {
      console.error("externalAuth: usage update failed:", err?.message || err);
    });

  return { ok: true, keyDoc };
}

/* ---------------- route plumbing ---------------- */

/** Copy CORS headers onto a NextResponse and return it. */
export function withCors(res, headers) {
  for (const [k, v] of Object.entries(headers || {})) res.headers.set(k, v);
  return res;
}

/** Standard preflight response. */
export function corsPreflight(req, keyDoc = null) {
  return withCors(
    new NextResponse(null, { status: 204 }),
    corsHeadersFor(req, keyDoc),
  );
}

/**
 * Authenticate + rate limit in one step.
 * Returns either { error: NextResponse } (already CORS-tagged) or
 * { keyDoc, cors }.
 */
export async function guardExternalRequest(req, { scope } = {}) {
  const auth = await authenticateExternalRequest(req, { scope });

  if (!auth.ok) {
    // No key doc yet, so no origin can be echoed - that is intentional.
    return {
      error: withCors(
        externalError(auth.status, auth.code, auth.message),
        corsHeadersFor(req, null),
      ),
    };
  }

  const cors = corsHeadersFor(req, auth.keyDoc);
  const rl = checkRateLimit(auth.keyDoc);

  if (!rl.ok) {
    const res = externalError(429, "rate_limited", "Rate limit exceeded", {
      retry_after: rl.retryAfter,
    });
    res.headers.set("Retry-After", String(rl.retryAfter));
    return { error: withCors(res, cors) };
  }

  return { keyDoc: auth.keyDoc, cors };
}

/**
 * Absolute base URL used when emitting signature URLs.
 * EXT_PUBLIC_BASE_URL is the explicit override; otherwise fall back to the
 * app-wide resolver (NEXT_PUBLIC_BASE_URL -> VERCEL_URL -> request Host).
 */
export function externalBaseUrl() {
  const override = clean(process.env.EXT_PUBLIC_BASE_URL).replace(/\/+$/, "");
  if (override) return override;
  return getBaseUrl().replace(/\/+$/, "");
}

/* ---------------- signed signature tokens ---------------- */

const DEFAULT_SIGNATURE_TTL_SEC = 900; // 15 minutes

function signatureSecret() {
  const secret = clean(process.env.EXT_SIGNATURE_SECRET) || clean(process.env.JWT_SECRET);
  if (!secret) throw new Error("Missing EXT_SIGNATURE_SECRET (or JWT_SECRET)");
  return secret;
}

export function signatureTtlSeconds() {
  const n = Number(process.env.EXT_SIGNATURE_TTL_SEC);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_SIGNATURE_TTL_SEC;
}

function hmacB64Url(payloadB64) {
  return crypto
    .createHmac("sha256", signatureSecret())
    .update(payloadB64)
    .digest("base64url");
}

/**
 * Mint a short-lived token that stands in for a Cloudinary URL, so partners
 * never receive the raw asset URL and cannot keep fetching it forever.
 * Returns { token, expiresAt } where expiresAt is an ISO string.
 */
export function signSignatureToken({ url, keyId }) {
  const ttl = signatureTtlSeconds();
  const exp = Math.floor(Date.now() / 1000) + ttl;

  const payload = { u: String(url || ""), k: String(keyId || ""), e: exp };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

  return {
    token: `${payloadB64}.${hmacB64Url(payloadB64)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

/**
 * Verify a signature token.
 * Returns { ok: true, url, keyId, exp } or { ok: false, reason }.
 */
export function verifySignatureToken(token) {
  const raw = clean(token);
  const dot = raw.lastIndexOf(".");
  if (dot <= 0 || dot === raw.length - 1) return { ok: false, reason: "malformed" };

  const payloadB64 = raw.slice(0, dot);
  const presented = raw.slice(dot + 1);

  let expected;
  try {
    expected = hmacB64Url(payloadB64);
  } catch {
    return { ok: false, reason: "no_secret" };
  }

  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const exp = Number(payload?.e);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const url = clean(payload?.u);
  if (!/^https?:\/\//i.test(url)) return { ok: false, reason: "malformed" };

  return { ok: true, url, keyId: clean(payload?.k), exp };
}

/* ---------------- input normalization (admin side) ---------------- */

export const VALID_SCOPES = ["classes.read"];

export function normalizeScopes(input) {
  const list = Array.isArray(input) ? input : [];
  const out = list.map(clean).filter((s) => VALID_SCOPES.includes(s));
  return out.length ? Array.from(new Set(out)) : ["classes.read"];
}

/** Origins must be an exact scheme+host[+port]: no path, no trailing slash. */
export function normalizeOrigins(input) {
  const list = Array.isArray(input) ? input : [];
  const out = [];

  for (const raw of list) {
    const s = clean(raw).replace(/\/+$/, "");
    if (!s) continue;
    try {
      out.push(new URL(s).origin);
    } catch {
      // ignore anything that is not a parseable origin
    }
  }

  return Array.from(new Set(out));
}

export function normalizeIps(input) {
  const list = Array.isArray(input) ? input : [];
  return Array.from(new Set(list.map(clean).filter(Boolean)));
}

/**
 * Public view of a key document. Never includes keyHash.
 */
export function publicKeyView(doc) {
  return {
    id: String(doc?._id || ""),
    name: String(doc?.name || ""),
    keyPrefix: String(doc?.keyPrefix || ""),
    scopes: Array.isArray(doc?.scopes) ? doc.scopes : [],
    allowedOrigins: Array.isArray(doc?.allowedOrigins) ? doc.allowedOrigins : [],
    allowedIps: Array.isArray(doc?.allowedIps) ? doc.allowedIps : [],
    rateLimitPerMin: Number(doc?.rateLimitPerMin || 0),
    expiresAt: doc?.expiresAt || null,
    revokedAt: doc?.revokedAt || null,
    lastUsedAt: doc?.lastUsedAt || null,
    lastUsedIp: String(doc?.lastUsedIp || ""),
    requestCount: Number(doc?.requestCount || 0),
    note: String(doc?.note || ""),
    createdBy: doc?.createdBy || null,
    createdAt: doc?.createdAt || null,
    updatedAt: doc?.updatedAt || null,
  };
}
