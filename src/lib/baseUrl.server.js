import "server-only";
import { headers } from "next/headers";

function clean(x) {
  return String(x || "").trim();
}

function trimSlash(x) {
  return clean(x).replace(/\/+$/, "");
}

export function getBaseUrl() {
  // 1) ถ้ามี override (เช่น set ไว้เฉพาะ prod) ใช้อันนี้ก่อน
  const env = trimSlash(process.env.NEXT_PUBLIC_BASE_URL);
  if (env) return env;

  // 2) Vercel: ใช้ URL ของ deployment ปัจจุบัน (Preview/Prod ได้หมด)
  // VERCEL_URL เป็น host ไม่มี protocol
  const vercel = clean(process.env.VERCEL_URL);
  if (vercel) return `https://${vercel}`;

  // 3) fallback: เดาจาก request headers (ใช้ได้บน server)
  const h = headers();
  const host = h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}
