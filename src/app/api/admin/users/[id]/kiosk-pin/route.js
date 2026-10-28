// src/app/api/admin/users/[id]/kiosk-pin/route.js
//
// PIN-P1: SA manages another account's kiosk PIN (ACCOUNTS_MANAGE).
//   POST   -> new PIN for that account -> { ok, setAt } (the PIN itself is never
//             returned; the owner sees it on their own My Account page)
//   DELETE -> remove the PIN
// Own account -> 400 use_my_account (the self flow asks for the password).
// Neither revokes kiosk sessions or staff unlocks already open.
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import AdminUser from "@/models/AdminUser";
import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import { clearPin, isPinConfigured, setNewPin } from "@/lib/kioskPin.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function fail(reason, error, status) {
  return json({ ok: false, reason, error }, status);
}

async function getId(routeCtx) {
  const p = await routeCtx?.params;
  return String(p?.id || "");
}

/** { ctx, target } or { denied } */
async function guard(routeCtx) {
  let ctx;
  try {
    ctx = await requirePerm(PERM.ACCOUNTS_MANAGE);
  } catch (e) {
    const status = e?.status === 403 ? 403 : 401;
    return { denied: fail(status === 403 ? "forbidden" : "unauthorized", status === 403 ? "Forbidden" : "Unauthorized", status) };
  }

  const id = await getId(routeCtx);
  if (id === ctx.userId) {
    return { denied: fail("use_my_account", "จัดการ PIN ของตัวเองที่หน้า My Account", 400) };
  }

  await dbConnect();
  const target = await AdminUser.findById(id).select("username name kioskPinSetAt").lean().catch(() => null);
  if (!target) return { denied: fail("not_found", "Not found", 404) };

  return { ctx, target };
}

async function audit(ctx, req, action, target, meta) {
  try {
    await writeAuditLog({
      ctx,
      req,
      action,
      entityType: "account",
      entityId: String(target._id),
      entityLabel: target.name || target.username,
      meta: { self: false, ...meta },
    });
  } catch (e) {
    console.warn(`[kioskPin] ${action} audit failed:`, e?.message || e);
  }
}

export async function POST(req, routeCtx) {
  const { ctx, target, denied } = await guard(routeCtx);
  if (denied) return denied;
  if (!isPinConfigured()) {
    return fail("pin_unavailable", "ระบบ PIN ยังไม่ได้ตั้งค่า (KIOSK_PIN_SECRET)", 500);
  }

  const res = await setNewPin(target._id, ctx.userId);
  if (!res) return fail("not_found", "Not found", 404);

  await audit(ctx, req, "kiosk.pin_regenerate", target, { replaced: !!target.kioskPinSetAt });
  return json({ ok: true, setAt: res.setAt });
}

export async function DELETE(req, routeCtx) {
  const { ctx, target, denied } = await guard(routeCtx);
  if (denied) return denied;

  const cleared = await clearPin(target._id);
  if (cleared) await audit(ctx, req, "kiosk.pin_clear", target, {});
  return json({ ok: true, cleared });
}
