// src/lib/rateLimit.server.js
//
// C3c: rate limit แบบใช้ร่วมกัน (Merchant lookup/redeem ตอนนี้, L3 /api/login, /api/kiosk/* ภายหลัง)
//
// serverless หลาย instance -> นับในหน่วยความจำอย่างเดียวไม่พอ จึงนับใน Mongo
//   collection "ratelimits": { _id: "<bucket>:<ip>:<windowStart>", count, expiresAt }
//   fixed window: $inc แบบ upsert ครั้งเดียวต่อคำขอ (atomic)
//   TTL index บน expiresAt ให้ Mongo ลบแถวเก่าเอง (go-live: สร้าง index นี้ใน production)
//
// DB ล่ม -> ปล่อยผ่าน (fail-open) แล้ว log — rate limit ห้ามทำให้ระบบหลักล้ม
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { clientIpFrom } from "@/lib/clientIp.server";

const COLLECTION = "ratelimits";
let indexReady = null;

function collection() {
  return mongoose.connection.db.collection(COLLECTION);
}

function ensureIndex() {
  if (!indexReady) {
    indexReady = collection()
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "expiresAt_ttl" })
      .catch((e) => {
        indexReady = null;
        console.warn("[rateLimit] createIndex failed:", e?.message || e);
      });
  }
  return indexReady;
}

/**
 * IP ของผู้เรียก — PIN-P2a: ใช้แหล่งที่เชื่อถือได้ (clientIp.server.js)
 * ไม่ใช่ x-forwarded-for ตัวแรก ซึ่งบน Vercel ผู้เรียกปลอมได้เอง
 */
export function clientIp(req) {
  return clientIpFrom(req) || "unknown";
}

/**
 * นับ 1 ครั้งใน bucket นี้ของ IP นี้
 * คืน { ok, count, limit, retryAfter } — ok:false = เกินโควตา
 * ต้องเรียกหลัง dbConnect()
 */
export async function hitRateLimit({ bucket, key, limit, windowSec = 60, now = new Date() }) {
  const nowMs = new Date(now).getTime();
  const windowMs = windowSec * 1000;
  const windowStart = Math.floor(nowMs / windowMs) * windowMs;
  const id = `${bucket}:${key}:${windowStart}`;

  try {
    await ensureIndex();
    const doc = await collection().findOneAndUpdate(
      { _id: id },
      {
        $inc: { count: 1 },
        $setOnInsert: { bucket, expiresAt: new Date(windowStart + windowMs + 60_000) },
      },
      { upsert: true, returnDocument: "after" },
    );
    // driver v6 คืนเอกสารตรง ๆ, v5 คืน { value }
    const count = (doc?.value ?? doc)?.count ?? 1;
    const retryAfter = Math.max(1, Math.ceil((windowStart + windowMs - nowMs) / 1000));
    return { ok: count <= limit, count, limit, retryAfter };
  } catch (e) {
    console.warn("[rateLimit] failed, allowing request:", e?.message || e);
    return { ok: true, count: 0, limit, retryAfter: 0 };
  }
}

/** ใช้ใน route: null = ผ่าน, ไม่งั้นคืน 429 */
export async function rateLimitGuard(req, { bucket, limit, windowSec = 60 }) {
  const r = await hitRateLimit({ bucket, key: clientIp(req), limit, windowSec });
  if (r.ok) return null;
  return NextResponse.json(
    { error: "rate_limited", reason: "rate_limited" },
    {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": String(r.retryAfter) },
    },
  );
}
