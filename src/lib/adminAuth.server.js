import { cookies } from "next/headers";

/**
 * requireAdmin (server-only)
 * - ปรับชื่อ cookie ให้ตรงกับโปรเจคคุณ: admin_token / token / etc.
 * - ถ้าโปรเจคคุณใช้ JWT จริง แนะนำให้ verify ด้วย secret อีกชั้น
 */
export async function requireAdmin() {
  const ck = await cookies();
  const token =
    ck.get("admin_token")?.value ||
    ck.get("adminToken")?.value ||
    ck.get("token")?.value ||
    "";

  if (!token) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }

  // TODO (optional): verify jwt signature here
  // return { token } for debugging/use
  return { token };
}
