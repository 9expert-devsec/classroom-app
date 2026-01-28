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
  // candidate อาจเป็น:
  // - full url: https://...
  // - path relative: instructors, /instructors, schedule?x=1
  const raw = String(candidate || "").trim();
  if (!raw) return "";

  // ถ้าเป็น full url ใช้เลย
  if (isAbsoluteUrl(raw)) {
    if (!queryString) return raw;
    return raw.includes("?") ? `${raw}&${queryString}` : `${raw}?${queryString}`;
  }

  // ถ้าเป็น path -> join กับ BASE
  const u = joinUrl(BASE, raw);
  if (!u) return "";

  if (!queryString) return u;
  return u.includes("?") ? `${u}&${queryString}` : `${u}?${queryString}`;
}

/**
 * fetchAiJson
 * - candidate: string | string[]  (ลองทีละตัวจนกว่าจะเจอ)
 * - opts.query: object | URLSearchParams | string
 * - จะใส่ header x-api-key อัตโนมัติ
 * - return: parsed JSON (body.json)
 */
export async function fetchAiJson(candidates, opts = {}) {
  const BASE = normalizeBase(process.env.AI_API_BASE);
  const KEY = process.env.AI_API_KEY;

  if (!BASE || !KEY) {
    const err = new Error("Missing AI_API_BASE or AI_API_KEY");
    err.status = 500;
    throw err;
  }

  const list = Array.isArray(candidates) ? candidates : [candidates];

  let qs = "";
  if (typeof opts.query === "string") {
    qs = opts.query.replace(/^\?/, "");
  } else if (opts.query instanceof URLSearchParams) {
    qs = opts.query.toString();
  } else if (opts.query && typeof opts.query === "object") {
    qs = new URLSearchParams(opts.query).toString();
  }

  let lastErr = null;

  for (const c of list) {
    const url = buildCandidateUrl(BASE, c, qs);
    if (!url) continue;

    try {
      const res = await fetch(url, {
        method: opts.method || "GET",
        headers: {
          "x-api-key": KEY,
          accept: "application/json",
          ...(opts.headers || {}),
        },
        cache: "no-store",
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });

      const body = await readBodySafe(res);

      // 200 แต่ไม่ใช่ JSON -> ลองตัวถัดไป (กัน upstream ส่ง HTML)
      if (res.ok && !body.okJson) continue;

      // ok + json => return เลย
      if (res.ok && body.okJson) return body.json;

      // 404 -> ลองตัวถัดไป
      if (!res.ok && res.status === 404) continue;

      // error อื่น ๆ -> โยน error ออก
      const msg =
        body.okJson
          ? JSON.stringify(body.json).slice(0, 500)
          : (body.text || "").slice(0, 500);

      const err = new Error(`AI upstream error ${res.status} @ ${url}: ${msg}`);
      err.status = res.status || 502;
      lastErr = err;
      break;
    } catch (e) {
      const err = new Error(`AI fetch failed @ ${url}: ${String(e?.message || e)}`);
      err.status = 502;
      lastErr = err;
      // ลองตัวถัดไปได้ ถ้าอยาก strict ก็ break
      continue;
    }
  }

  if (lastErr) throw lastErr;

  const err = new Error("AI upstream not found in any candidate path");
  err.status = 404;
  throw err;
}
