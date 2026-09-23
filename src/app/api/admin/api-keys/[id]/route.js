// src/app/api/admin/api-keys/[id]/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import ExternalApiKey from "@/models/ExternalApiKey";
import {
  normalizeIps,
  normalizeOrigins,
  normalizeScopes,
  publicKeyView,
} from "@/lib/externalAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/* ---------------- PATCH: update ---------------- */

export async function PATCH(req, { params }) {
  try {
    const ctx = await requirePerm(PERM.API_KEYS_MANAGE);
    await dbConnect();

    const id = clean(params?.id);
    if (!id) return jsonError("missing id", 400);

    const existing = await ExternalApiKey.findById(id, { keyHash: 0 }).lean();
    if (!existing) return jsonError("ไม่พบคีย์นี้", 404);

    const body = await req.json().catch(() => ({}));
    const $set = {};

    if (body?.name !== undefined) {
      const name = clean(body.name);
      if (!name) return jsonError("ต้องระบุชื่อคีย์", 400);
      $set.name = name;
    }

    if (body?.scopes !== undefined) $set.scopes = normalizeScopes(body.scopes);

    if (body?.allowedOrigins !== undefined) {
      $set.allowedOrigins = normalizeOrigins(body.allowedOrigins);
    }

    if (body?.allowedIps !== undefined) {
      $set.allowedIps = normalizeIps(body.allowedIps);
    }

    if (body?.rateLimitPerMin !== undefined) {
      const n = Number(body.rateLimitPerMin);
      if (!Number.isFinite(n) || n <= 0) {
        return jsonError("rateLimitPerMin ต้องเป็นตัวเลขมากกว่า 0", 400);
      }
      $set.rateLimitPerMin = Math.floor(n);
    }

    if (body?.expiresAt !== undefined) {
      const raw = clean(body.expiresAt);
      if (!raw) {
        $set.expiresAt = null;
      } else {
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) {
          return jsonError("วันหมดอายุไม่ถูกต้อง", 400);
        }
        $set.expiresAt = d;
      }
    }

    if (body?.note !== undefined) $set.note = clean(body.note);

    if (!Object.keys($set).length) {
      return jsonError("ไม่มีข้อมูลที่จะแก้ไข", 400);
    }

    const updated = await ExternalApiKey.findByIdAndUpdate(
      id,
      { $set },
      { new: true, projection: { keyHash: 0 } },
    ).lean();

    const after = publicKeyView(updated);

    await writeAuditLog({
      ctx,
      req,
      action: "update",
      entityType: "api-key",
      entityId: id,
      entityLabel: after.name,
      before: publicKeyView(existing),
      after,
      ignorePaths: AUDIT_IGNORE,
    });

    return NextResponse.json({ ok: true, item: after });
  } catch (e) {
    console.error("admin/api-keys PATCH:", e?.message || e);
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}

/* ---------------- DELETE: revoke ---------------- */

export async function DELETE(req, { params }) {
  try {
    const ctx = await requirePerm(PERM.API_KEYS_MANAGE);
    await dbConnect();

    const id = clean(params?.id);
    if (!id) return jsonError("missing id", 400);

    const existing = await ExternalApiKey.findById(id, { keyHash: 0 }).lean();
    if (!existing) return jsonError("ไม่พบคีย์นี้", 404);

    if (existing.revokedAt) {
      return jsonError("คีย์นี้ถูกยกเลิกไปแล้ว", 409);
    }

    // Revoke, never hard-delete: the row is the audit trail for every request
    // the key ever made.
    const updated = await ExternalApiKey.findByIdAndUpdate(
      id,
      { $set: { revokedAt: new Date() } },
      { new: true, projection: { keyHash: 0 } },
    ).lean();

    const after = publicKeyView(updated);

    await writeAuditLog({
      ctx,
      req,
      action: "delete",
      entityType: "api-key",
      entityId: id,
      entityLabel: after.name,
      before: publicKeyView(existing),
      after,
      ignorePaths: AUDIT_IGNORE,
    });

    return NextResponse.json({ ok: true, item: after });
  } catch (e) {
    console.error("admin/api-keys DELETE:", e?.message || e);
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
