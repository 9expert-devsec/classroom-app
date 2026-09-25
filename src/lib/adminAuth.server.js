// src/lib/adminAuth.server.js
import { cookies } from "next/headers";
import dbConnect from "@/lib/mongoose";
import AdminUser from "@/models/AdminUser";
import { verifyAdminToken } from "@/utils/auth";
import { buildPermSet, ROLE_LABELS } from "@/lib/acl";
import { verifyPassword } from "@/lib/password.server";

const TOKEN_NAME = process.env.ADMIN_TOKEN_NAME || "admin_token";

function unauthorized() {
  const err = new Error("Unauthorized");
  err.status = 401;
  return err;
}

function forbidden() {
  const err = new Error("Forbidden");
  err.status = 403;
  return err;
}

export async function requireAdmin() {
  const ck = cookies();
  const token = ck.get(TOKEN_NAME)?.value || "";
  if (!token) throw unauthorized();

  let payload;
  try {
    payload = await verifyAdminToken(token);
  } catch {
    throw unauthorized();
  }

  const userId = String(payload?.userId || "");
  if (!userId) throw unauthorized();

  await dbConnect();
  const user = await AdminUser.findById(userId).lean();
  if (!user || !user.isActive) throw unauthorized();

  const roleCode = String(user.roleCode || "OPS").toUpperCase();
  const permSet = buildPermSet(roleCode, user.extraPerms || []);

  return {
    token,
    userId,
    roleCode,
    roleLabel: ROLE_LABELS[roleCode] || roleCode,
    permissions: Array.from(permSet),
    permSet,
    user: {
      id: String(user._id),
      username: user.username,
      name: user.name || "",
      avatarUrl: user.avatar?.url || "",
      roleCode,
      isActive: !!user.isActive,
    },
  };
}

/**
 * Username/password check against AdminUser. Returns the (non-lean) user
 * document when the account exists, is active and the password matches;
 * null otherwise. No bootstrap path and no side effects - /api/login keeps its
 * own first-run bootstrap and its own lastLoginAt update.
 */
export async function verifyAdminCredentials(username, password) {
  const u = String(username || "").trim().toLowerCase();
  const p = String(password || "").trim();
  if (!u || !p) return null;

  await dbConnect();
  const user = await AdminUser.findOne({ username: u });
  if (!user || !user.isActive) return null;

  const ok = await verifyPassword(p, user.passwordHash);
  return ok ? user : null;
}

export async function requirePerm(perm) {
  const ctx = await requireAdmin();
  if (!perm) return ctx;
  if (!ctx.permSet?.has?.(perm)) throw forbidden();
  return ctx;
}
