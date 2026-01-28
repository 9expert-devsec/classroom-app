const RAW_BASE = process.env.AI_API_BASE;
const KEY = process.env.AI_API_KEY;

function cleanStr(x) {
  return String(x || "").trim();
}

export function normalizeBase(base = RAW_BASE) {
  const b = cleanStr(base);
  if (!b) return "";
  return b.replace(/\/+$/, "");
}

export function requireAiEnv() {
  const BASE = normalizeBase(RAW_BASE);
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

export async function tryFetchUpstream(urls, { signal } = {}) {
  const { KEY } = requireAiEnv();

  for (const url of urls) {
    const res = await fetch(url, {
      headers: { "x-api-key": KEY, accept: "application/json" },
      cache: "no-store",
      signal,
    }).catch(() => null);

    if (!res) continue;

    const body = await readBodySafe(res);

    // 200 แต่ไม่ใช่ JSON (เช่น HTML) -> ลองตัวถัดไป
    if (res.ok && !body.okJson) continue;

    if (res.ok && body.okJson) {
      return { ok: true, url, status: res.status, body: body.json };
    }

    if (!res.ok && res.status === 404) continue;

    return {
      ok: false,
      url,
      status: res.status,
      contentType: body.ct,
      detail: body.okJson ? body.json : body.text.slice(0, 500),
    };
  }

  return {
    ok: false,
    url: urls[0] || "",
    status: 404,
    contentType: "text/plain",
    detail: "not found in any upstream path",
  };
}

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

export function buildPublicCoursesCandidates({ BASE, qs, key }) {
  const candidates = [];
  function add(path, mode = "query") {
    if (mode === "query") candidates.push(`${BASE}/${path}${qs ? `?${qs}` : ""}`);
    if (mode === "segment" && key) candidates.push(`${BASE}/${path}/${encodeURIComponent(key)}`);
  }

  const paths = [
    "public-courses",
    "public-course",
    "publiccourses",
    "public_course",
    "public_courses",
    "courses",
    "course",
  ];

  for (const p of paths) {
    add(p, "query");
    add(p, "segment");
  }
  return candidates;
}

export function buildProgramCandidates({ BASE, qs }) {
  return [`${BASE}/programs?${qs}`, `${BASE}/program?${qs}`];
}
