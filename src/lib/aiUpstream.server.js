function cleanUrl(x) {
  return String(x || "").trim().replace(/\/+$/, "");
}

export function aiBase() {
  const base = cleanUrl(process.env.AI_API_BASE || "");
  if (!base) throw new Error("AI_API_BASE missing");
  return base;
}

export function aiHeaders() {
  const key = String(process.env.AI_API_KEY || "").trim();
  return {
    "content-type": "application/json",
    ...(key ? { authorization: `Bearer ${key}` } : {}),
  };
}

export async function fetchAiJson(pathWithQuery) {
  const url = `${aiBase()}${pathWithQuery.startsWith("/") ? "" : "/"}${pathWithQuery}`;
  const res = await fetch(url, {
    method: "GET",
    headers: aiHeaders(),
    // อย่า cache upstream
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI upstream ${res.status}: ${t || url}`);
  }

  return res.json();
}
