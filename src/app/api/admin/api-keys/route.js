// src/app/api/admin/api-keys/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import ExternalApiKey from "@/models/ExternalApiKey";
import {
  generateApiKey,
  normalizeIps,
  normalizeOrigins,
  normalizeScopes,
  publicKeyView,
} from "@/lib/externalAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The raw key must never reach an audit diff. keyHash is excluded too - it is
// not secret in the same way, but there is no reason to mirror it into logs.
const AUDIT_IGNORE = ["keyHash", "rawKey"];

function clean(x) {
  return String(x ?? "").trim();
}

function jsonError(message, status = 500) {
  return NextResponse.json(
    { ok: false, error: message || "Server error" },
    { status },
  );
}

/* ---------------- GET: list ---------------- */

export async function GET() {
  try {
    await requirePerm(PERM.API_KEYS_MANAGE);
    await dbConnect();

    // Projection excludes keyHash so it cannot leak through this endpoint.
    const docs = await ExternalApiKey.find({}, { keyHash: 0 })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      ok: true,
      items: docs.map(publicKeyView),
    });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}

/* ---------------- POST: create ---------------- */

export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.API_KEYS_MANAGE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));

    const name = clean(body?.name);
    if (!name) return jsonError("ต้องระบุชื่อคีย์", 400);

    const expiresRaw = clean(body?.expiresAt);
    let expiresAt = null;
    if (expiresRaw) {
      const d = new Date(expiresRaw);
      if (Number.isNaN(d.getTime())) return jsonError("วันหมดอายุไม่ถูกต้อง", 400);
      expiresAt = d;
    }

    const rateLimitPerMin = Number(body?.rateLimitPerMin);

    const { raw, prefix, hash } = generateApiKey();

    const doc = await ExternalApiKey.create({
      name,
      keyPrefix: prefix,
      keyHash: hash,
      scopes: normalizeScopes(body?.scopes),
      allowedOrigins: normalizeOrigins(body?.allowedOrigins),
      allowedIps: normalizeIps(body?.allowedIps),
      rateLimitPerMin:
        Number.isFinite(rateLimitPerMin) && rateLimitPerMin > 0
          ? Math.floor(rateLimitPerMin)
          : 60,
      expiresAt,
      note: clean(body?.note),
      createdBy: {
        userId: clean(ctx?.user?.id),
        username: clean(ctx?.user?.username),
        name: clean(ctx?.user?.name),
      },
    });

    const view = publicKeyView(doc.toObject());

    await writeAuditLog({
      ctx,
      req,
      action: "create",
      entityType: "api-key",
      entityId: String(doc._id),
      entityLabel: name,
      before: null,
      after: view,
      ignorePaths: AUDIT_IGNORE,
    });

    // The raw key is returned here and nowhere else, ever.
    return NextResponse.json({
      ok: true,
      showOnce: true,
      rawKey: raw,
      item: view,
    });
  } catch (e) {
    console.error("admin/api-keys POST:", e?.message || e);
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
