import AuditLog from "@/models/AuditLog";

function safeStr(x) {
  return String(x ?? "").trim();
}

function isPlainObject(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function toComparable(v) {
  if (v === null || v === undefined) return v;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function buildDiffs(before, after, opts = {}) {
  const ignore = new Set([
    "_id",
    "__v",
    "createdAt",
    "updatedAt",
    ...(opts.ignorePaths || []),
  ]);

  const out = [];
  const max = opts.maxItems || 80;

  if (!before && after) {
    for (const k of Object.keys(after || {})) {
      if (ignore.has(k)) continue;
      out.push({ path: k, before: null, after: after[k] });
      if (out.length >= max) break;
    }
    return out;
  }

  if (before && !after) {
    for (const k of Object.keys(before || {})) {
      if (ignore.has(k)) continue;
      out.push({ path: k, before: before[k], after: null });
      if (out.length >= max) break;
    }
    return out;
  }

  const b = before || {};
  const a = after || {};
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));

  for (const k of keys) {
    if (ignore.has(k)) continue;

    const bv = b[k];
    const av = a[k];

    if (isPlainObject(bv) || isPlainObject(av)) {
      const b2 = isPlainObject(bv) ? bv : {};
      const a2 = isPlainObject(av) ? av : {};
      const subKeys = Array.from(
        new Set([...Object.keys(b2), ...Object.keys(a2)]),
      );

      for (const sk of subKeys) {
        const path = `${k}.${sk}`;
        if (ignore.has(path)) continue;

        const c1 = toComparable(b2[sk]);
        const c2 = toComparable(a2[sk]);
        if (c1 !== c2) out.push({ path, before: b2[sk], after: a2[sk] });
        if (out.length >= max) return out;
      }
      continue;
    }

    const c1 = toComparable(bv);
    const c2 = toComparable(av);
    if (c1 !== c2) out.push({ path: k, before: bv, after: av });
    if (out.length >= max) return out;
  }

  return out;
}

export async function writeAuditLog({
  ctx, // from requireAdmin()/requirePerm()
  req, // NextRequest
  action = "custom",
  entityType = "",
  entityId = "",
  entityLabel = "",
  before = null,
  after = null,
  meta = null,
  ignorePaths = [],
}) {
  const actor = {
    userId: safeStr(ctx?.user?.id || ctx?.userId),
    username: safeStr(ctx?.user?.username),
    name: safeStr(ctx?.user?.name),
    avatarUrl: safeStr(ctx?.user?.avatarUrl),
    roleCode: safeStr(ctx?.roleCode),
  };

  const diffs = buildDiffs(before, after, { ignorePaths, maxItems: 80 });

  const ip =
    safeStr(req?.headers?.get?.("x-forwarded-for")) ||
    safeStr(req?.headers?.get?.("x-real-ip")) ||
    "";
  const userAgent = safeStr(req?.headers?.get?.("user-agent")) || "";

  await AuditLog.create({
    actor,
    action,
    entityType,
    entityId,
    entityLabel,
    diffs,
    meta,
    ip,
    userAgent,
  });
}
