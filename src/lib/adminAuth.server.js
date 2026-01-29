import { cookies } from "next/headers";

const TOKEN_NAME = process.env.ADMIN_TOKEN_NAME || "admin_token";

export async function requireAdmin() {
  const ck = cookies();
  const token = ck.get(TOKEN_NAME)?.value || "";

  if (!token) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }

  return { token };
}
