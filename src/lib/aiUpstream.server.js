// src/lib/aiUpstream.server.js
export const dynamic = "force-dynamic";

function cleanStr(x) {
  return String(x || "").trim();
}

function normalizeBase(base) {
  const b = cleanStr(base);
  return b ? b.replace(/\/+$/, "") : "";
}

function isAbsoluteUrl(x) {
  return /^https?:\/\//i.test(String(x || ""));
}

function joinUrl(base, path) {
  const b = normalizeBase(base);
  const p = String(path || "");
  if (!b) return "";
  if (!p) return b;
  if (p.startsWith("/")) return `${b}${p}`;
  return `${b}/${p}`;
}

async function readBodySafe(res) {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text().catch(() => "");
  const isJson = ct.includes("application/json");
  if (!isJson) return { okJson: false, ct, text, json: null };
  try {
    const json = JSON.parse(text);
    return { okJson: true, ct, text, json };
  } catch {
    return { okJson: false, ct, text, json: null };
  }
}

function buildCandidateUrl(BASE, candidate, queryString) {
  const raw = String(candidate || "").trim();
  if (!raw) return "";

  // full url
  if (isAbsoluteUrl(raw)) {
    if (!queryString) return raw;
    return raw.includes("?")
      ? `${raw}&${queryString}`
      : `${raw}?${queryString}`;
  }

  // path relative
  const u = joinUrl(BASE, raw);
  if (!u) return "";

  if (!queryString) return u;
  return u.includes("?") ? `${u}&${queryString}` : `${u}?${queryString}`;
}

/* =========================
 * Public utils (export)
 * ========================= */

export function requireAiEnv() {
  const BASE = normalizeBase(process.env.AI_API_BASE);
  const KEY = cleanStr(process.env.AI_API_KEY);

  if (!BASE || !KEY) {
    const err = new Error("Missing AI_API_BASE or AI_API_KEY");
    err.status = 500;
    err.detail = {
      AI_API_BASE: BASE || null,
      AI_API_KEY: KEY ? "***set***" : null,
    };
    throw err;
  }

  return { BASE, KEY };
}

export async function tryFetchUpstream(
  urls,
  { method = "GET", headers = {}, body } = {},
) {
  const { KEY } = requireAiEnv();

  for (const url of urls || []) {
    const res = await fetch(url, {
      method,
      headers: {
        "x-api-key": KEY,
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      cache: "no-store",
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);

    if (!res) continue;

    const parsed = await readBodySafe(res);

    // 200 แต่ไม่ใช่ JSON (เช่น HTML) => ลองตัวถัดไป
    if (res.ok && !parsed.okJson) continue;

    if (res.ok && parsed.okJson) {
      return { ok: true, url, status: res.status, body: parsed.json };
    }

    // 404 => ลองตัวถัดไป
    if (!res.ok && res.status === 404) continue;

    // error อื่น => ส่งกลับทันที
    return {
      ok: false,
      url,
      status: res.status,
      contentType: parsed.ct,
      detail: parsed.okJson ? parsed.json : (parsed.text || "").slice(0, 500),
    };
  }

  return {
    ok: false,
    url: urls?.[0] || "",
    status: 404,
    contentType: "text/plain",
    detail: "not found in any upstream path",
  };
}

// ใช้ normalize ให้ได้ item เดียว (เอาไว้ใช้กับ public-courses)
export function pickSingleItem(payload, courseIdOrId) {
  const directItem = payload?.item || payload?.data || null;
  if (directItem) return directItem;

  const items = Array.isArray(payload?.items) ? payload.items : null;
  if (!items) return null;

  const key = String(courseIdOrId || "").trim();
  if (!key) return null;

  return (
    items.find((x) => String(x?._id || "") === key) ||
    items.find((x) => String(x?.id || "") === key) ||
    items.find((x) => String(x?.course_id || "") === key) ||
    items.find((x) => String(x?.courseId || "") === key) ||
    items.find((x) => String(x?.course_code || "") === key) ||
    items.find((x) => String(x?.courseCode || "") === key) ||
    null
  );
}

// ✅ สร้าง candidate URLs สำหรับ public-courses (รองรับ BASE ที่ส่งมา)
export function buildPublicCoursesCandidates({ BASE, qs = "", key = "" } = {}) {
  const env = !BASE ? requireAiEnv() : null;
  const base = normalizeBase(BASE || env.BASE);

  const query = typeof qs === "string" ? qs.replace(/^\?/, "") : "";

  const paths = [
    "public-courses",
    "public-course",
    "publiccourses",
    "public_course",
    "public_courses",
    "courses",
    "course",
  ];

  const candidates = [];

  function add(path, mode = "query") {
    if (mode === "query") {
      candidates.push(buildCandidateUrl(base, path, query));
    } else if (mode === "segment" && key) {
      candidates.push(joinUrl(base, `${path}/${encodeURIComponent(key)}`));
    }
  }

  for (const p of paths) {
    add(p, "query");
    add(p, "segment");
  }

  return candidates.filter(Boolean);
}

// ✅ สร้าง candidate URLs สำหรับ program (รองรับ BASE ที่ส่งมา)
export function buildProgramCandidates({ BASE, qs = "" } = {}) {
  const env = !BASE ? requireAiEnv() : null;
  const base = normalizeBase(BASE || env.BASE);

  const query = typeof qs === "string" ? qs.replace(/^\?/, "") : "";

  return [
    buildCandidateUrl(base, "programs", query),
    buildCandidateUrl(base, "program", query),
  ].filter(Boolean);
}

/**
 * fetchAiJson
 * ใช้ได้ทั้ง:
 * - fetchAiJson("instructors")
 * - fetchAiJson(["instructors","instructor"])
 * - fetchAiJson("schedule", { query: { from, to } })
 */
export async function fetchAiJson(candidates, opts = {}) {
  const { BASE } = requireAiEnv();

  const list = Array.isArray(candidates) ? candidates : [candidates];

  let qs = "";
  if (typeof opts.query === "string") qs = opts.query.replace(/^\?/, "");
  else if (opts.query instanceof URLSearchParams) qs = opts.query.toString();
  else if (opts.query && typeof opts.query === "object")
    qs = new URLSearchParams(opts.query).toString();

  const urls = list.map((c) => buildCandidateUrl(BASE, c, qs)).filter(Boolean);

  const upstream = await tryFetchUpstream(urls, {
    method: opts.method || "GET",
    headers: opts.headers || {},
    body: opts.body,
  });

  if (!upstream.ok) {
    const err = new Error(
      `AI upstream error ${upstream.status || 502} @ ${upstream.url}: ${String(
        upstream.detail || "",
      ).slice(0, 300)}`,
    );
    err.status = upstream.status || 502;
    err.upstream = upstream;
    throw err;
  }

  return upstream.body;
}
