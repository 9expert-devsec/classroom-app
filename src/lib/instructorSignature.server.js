// src/lib/instructorSignature.server.js
import crypto from "node:crypto";
import AiInstructor from "@/models/AiInstructor";
import InstructorSignature from "@/models/InstructorSignature";

/* ---------------- normalization ---------------- */

// Zero-width joiners / BOM occasionally ride along with pasted Thai names.
const ZERO_WIDTH_RE = /[\u200B\u200C\u200D\uFEFF]/g;

// Thai academic honorifics. Ordered LONGEST FIRST so "อ.ดร." is matched as a
// whole and not eaten by the shorter "อ." alternative (JS alternation is
// leftmost-first, so the order in this regex is the precedence).
const HONORIFIC_RE = /^\s*(?:ผศ\.ดร\.|รศ\.ดร\.|อ\.ดร\.|ศ\.ดร\.|ผศ\.|รศ\.|ดร\.|อ\.|ศ\.)\s*/;

/**
 * Shared normalization used by every key: NFC -> strip zero-width ->
 * collapse whitespace -> trim -> lowercase.
 */
function normalizeBasic(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(ZERO_WIDTH_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Normalize an instructor display name into a join key.
 * Real data contains double spaces ("อ.ภัคพงศ์  กฤตวัฒน์") and mixed
 * honorifics, so this normalization is load-bearing for the class -> signature
 * join, not cosmetic.
 */
export function normalizeInstructorName(name) {
  const base = String(name ?? "")
    .normalize("NFC")
    .replace(ZERO_WIDTH_RE, "")
    .replace(HONORIFIC_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return base.replace(/^\.+/, "").replace(/\.+$/, "").trim();
}

/**
 * Resolve the storage key for an instructor.
 * Precedence: email > code > name.
 */
export function normalizeInstructorKey({ email, code, name } = {}) {
  const e = normalizeBasic(email);
  if (e) return e;

  const c = normalizeBasic(code);
  if (c) return c;

  return normalizeInstructorName(name);
}

/**
 * Deterministic Cloudinary public_id for an instructor key.
 * Derived from a hash rather than the name because instructor names are Thai
 * and Cloudinary public_ids should stay ASCII.
 */
export function signaturePublicIdFor(instructorKey) {
  const key = String(instructorKey || "");
  if (!key) return "";
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 24);
}

/* ---------------- upstream (MSDB) signature lookup ---------------- */

// Candidate keys we would accept from AiInstructor.raw if MSDB ever ships an
// instructor signature.
//
// NOTE (2026-08): AiInstructor.raw currently contains only
//   _id, name_th, name_en, bio, programs, updatedAt
// i.e. no signature key of any kind. This branch is therefore
// forward-compatibility only and is never taken against today's data. It is
// kept so that adding a signature field upstream in MSDB starts working here
// with no code change.
const UPSTREAM_SIGNATURE_KEYS = [
  "signature_url",
  "signatureUrl",
  "signature",
  "sign_image",
  "sign_url",
  "instructor_signature",
  "instructor_sign_url",
];

function pickUpstreamSignatureUrl(raw) {
  if (!raw || typeof raw !== "object") return "";
  for (const key of UPSTREAM_SIGNATURE_KEYS) {
    const value = raw[key];
    if (typeof value === "string" && value.trim().startsWith("http")) {
      return value.trim();
    }
  }
  return "";
}

/* ---------------- resolution ---------------- */

function describe(instructor) {
  const src = instructor || {};
  const name = String(src.name || src.fullname || "").trim();
  const email = String(src.email || "").trim();
  const code = String(src.code || "").trim();

  return {
    name,
    email,
    code,
    emailKey: normalizeBasic(email),
    nameKey: normalizeInstructorName(name),
    instructorKey: normalizeInstructorKey({ email, code, name }),
  };
}

function aiLabel(doc) {
  return {
    externalId: String(doc?.externalId || ""),
    name: String(doc?.name || doc?.raw?.name_th || ""),
    nameEn: String(doc?.raw?.name_en || "").trim(),
    nameTh: String(doc?.raw?.name_th || doc?.name || "").trim(),
    email: String(doc?.email || ""),
    code: String(doc?.code || ""),
  };
}

/**
 * Display name rule, mirroring MSDB's own admin UI: the English name is used
 * when present, otherwise the Thai name is the fallback.
 */
export function displayInstructorName({ nameEn, nameTh } = {}) {
  return String(nameEn || "").trim() || String(nameTh || "").trim();
}

/**
 * Resolve, for each instructor, both the matched AiInstructor row and the
 * signature to use. Always exactly two database queries regardless of how many
 * instructors are passed in.
 *
 * Returns one entry per input instructor:
 *   { name, nameEn, nameTh, email, code, nameKey, instructorKey, ai, signature }
 * where `ai` is { externalId, name, nameEn, nameTh, email, code } | null and
 * `signature` is { url, publicId, source } | null.
 *
 * nameEn is OUTPUT ONLY. Matching still keys off the Thai name because that is
 * what Class.instructors[].name stores.
 */
export async function resolveInstructorMatches(instructors = []) {
  const list = Array.isArray(instructors) ? instructors : [];
  const descs = list.map(describe);

  if (!descs.length) return [];

  const keys = new Set();
  const nameKeys = new Set();
  for (const d of descs) {
    if (d.instructorKey) keys.add(d.instructorKey);
    if (d.emailKey) keys.add(d.emailKey);
    if (d.nameKey) nameKeys.add(d.nameKey);
  }

  // Query 1: every candidate signature row in one round trip.
  const sigDocs = keys.size || nameKeys.size
    ? await InstructorSignature.find({
        isActive: true,
        $or: [
          { instructorKey: { $in: Array.from(keys) } },
          { nameKey: { $in: Array.from(nameKeys) } },
        ],
      }).lean()
    : [];

  const sigByKey = new Map();
  const sigByNameKey = new Map();
  for (const doc of sigDocs) {
    const k = String(doc.instructorKey || "");
    if (k && !sigByKey.has(k)) sigByKey.set(k, doc);

    const nk = String(doc.nameKey || "");
    if (nk && !sigByNameKey.has(nk)) sigByNameKey.set(nk, doc);
  }

  // Query 2: the whole AiInstructor catalogue. It is a small cached mirror of
  // the MSDB instructor roster (10 rows as of 2026-08) and matching happens on
  // normalized names, which cannot be expressed as a Mongo query - so it is
  // fetched once and indexed in memory rather than queried per instructor.
  const aiDocs = await AiInstructor.find({}, { externalId: 1, name: 1, email: 1, code: 1, raw: 1 })
    .limit(2000)
    .lean();

  const aiByEmail = new Map();
  const aiByNameKey = new Map();
  for (const doc of aiDocs) {
    const e = normalizeBasic(doc.email);
    if (e && !aiByEmail.has(e)) aiByEmail.set(e, doc);

    for (const candidate of [doc.name, doc?.raw?.name_th, doc?.raw?.name_en]) {
      const nk = normalizeInstructorName(candidate);
      if (nk && !aiByNameKey.has(nk)) aiByNameKey.set(nk, doc);
    }
  }

  return descs.map((d) => {
    const aiDoc =
      (d.emailKey && aiByEmail.get(d.emailKey)) ||
      (d.nameKey && aiByNameKey.get(d.nameKey)) ||
      null;

    let signature = null;

    // 1) local record keyed by the email-derived instructorKey
    const byEmailKey = d.emailKey ? sigByKey.get(d.emailKey) : null;

    // 2) local record matched on the normalized name
    const byNameKey = !byEmailKey && d.nameKey ? sigByNameKey.get(d.nameKey) : null;

    // Also honour a record whose instructorKey *is* the name key (the common
    // case, since instructorKey falls back to the name when no email exists).
    const byKey =
      !byEmailKey && !byNameKey && d.instructorKey
        ? sigByKey.get(d.instructorKey)
        : null;

    const local = byEmailKey || byNameKey || byKey || null;

    if (local && String(local?.signature?.url || "").trim()) {
      signature = {
        url: String(local.signature.url).trim(),
        publicId: String(local.signature.publicId || ""),
        source: "local",
      };
    } else {
      // 3) upstream MSDB payload (see UPSTREAM_SIGNATURE_KEYS note above)
      const upstreamUrl = pickUpstreamSignatureUrl(aiDoc?.raw);
      if (upstreamUrl) {
        signature = { url: upstreamUrl, publicId: "", source: "upstream" };
      }
    }

    const ai = aiDoc ? aiLabel(aiDoc) : null;

    return {
      name: d.name,
      // English name from MSDB. May be "" - it is maintained upstream.
      nameEn: ai?.nameEn || "",
      // Thai name: upstream raw.name_th > AiInstructor.name > class-side name.
      nameTh: ai?.nameTh || d.name,
      email: d.email,
      code: d.code || aiDoc?.code || "",
      nameKey: d.nameKey,
      instructorKey: d.instructorKey,
      ai,
      signature,
    };
  });
}

/**
 * Batched signature resolution.
 * Returns one { url, publicId, source } | null per input instructor.
 */
export async function resolveInstructorSignatures(instructors = []) {
  const matches = await resolveInstructorMatches(instructors);
  return matches.map((m) => m.signature);
}

/**
 * Single-instructor convenience wrapper. Prefer resolveInstructorSignatures()
 * when handling more than one instructor.
 */
export async function resolveInstructorSignature(instructor) {
  const [sig] = await resolveInstructorSignatures([instructor]);
  return sig || null;
}
