// src/lib/couponExpiry.server.js

function clean(x) {
  return String(x ?? "").trim();
}

/**
 * ===============================
 * Coupon expire feature flag
 * ===============================
 *
 * ใช้สำหรับ "ปิดระบบหมดอายุชั่วคราว" ตอนเทส
 *
 * วิธีใช้:
 * - ปิด expire ชั่วคราว => ตั้งเป็น true
 * - กลับโหมดปกติ      => ตั้งเป็น false
 *
 * ตอนนี้:
 *   true  = ไม่เช็คหมดอายุจากเวลา 15:00 และไม่ sync status เป็น expired
 *   false = ใช้งาน expire ตามปกติ
 */
const DISABLE_COUPON_EXPIRE = true;

function toBkkYMD(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

export function getCouponIssuedAt(doc) {
  return (
    doc?.issuedAt ||
    doc?.createdAt ||
    doc?.generatedAt ||
    doc?.updatedAt ||
    null
  );
}

export function getCouponDayYMD(doc) {
  const ymd = clean(doc?.dayYMD);
  if (ymd) return ymd.slice(0, 10);

  const issuedAt = getCouponIssuedAt(doc);
  if (!issuedAt) return "";

  return toBkkYMD(issuedAt);
}

export function getCouponExpireAt(doc) {
  const dayYMD = getCouponDayYMD(doc);
  if (!dayYMD) return null;

  // โหมดปกติ: คูปองหมดอายุ 15:00 น. ของวันคูปอง (+07:00)
  const dt = new Date(`${dayYMD}T15:00:00+07:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function isCouponExpired(doc, now = new Date()) {
  // ✅ ถ้าตั้ง flag = true จะ "ปิดการเช็คหมดอายุจากเวลา" ชั่วคราว
  // ถ้าจะกลับมาใช้ expire ตามปกติ ให้เปลี่ยน DISABLE_COUPON_EXPIRE = false
  if (DISABLE_COUPON_EXPIRE) return false;

  const expireAt = getCouponExpireAt(doc);
  if (!expireAt) return false;
  return expireAt.getTime() <= now.getTime();
}

export function getCouponEffectiveStatus(doc, now = new Date()) {
  const raw = clean(doc?.status || "issued");

  // redeemed ยังมีผลเสมอ
  if (raw === "redeemed") return "redeemed";

  // ✅ ตอนปิด expire ชั่วคราว:
  // - ignore raw status = "expired"
  // - ignore การหมดอายุจากเวลา
  // - ทุกใบที่ยังไม่ redeemed จะถือเป็น issued
  if (DISABLE_COUPON_EXPIRE) {
    return "issued";
  }

  // โหมดปกติ
  if (raw === "expired") return "expired";
  if (isCouponExpired(doc, now)) return "expired";

  return "issued";
}

export async function syncCouponExpiredStatus(Model, doc, now = new Date()) {
  // ✅ ตอนปิด expire ชั่วคราว:
  // - ไม่ sync status เป็น expired ลง DB
  // - ถ้า redeemed อยู่แล้ว ให้คง redeemed
  // - ถ้ายังไม่ redeemed ให้ถือเป็น issued
  //
  // ถ้าจะกลับโหมดปกติ ให้เปลี่ยน DISABLE_COUPON_EXPIRE = false
  if (DISABLE_COUPON_EXPIRE) {
    const raw = clean(doc?.status || "issued");
    return raw === "redeemed" ? "redeemed" : "issued";
  }

  const effectiveStatus = getCouponEffectiveStatus(doc, now);

  if (effectiveStatus !== "expired") return effectiveStatus;

  const raw = clean(doc?.status || "issued");
  if (raw === "expired" || raw === "redeemed") return effectiveStatus;
  if (!doc?._id) return effectiveStatus;

  const expireAt = getCouponExpireAt(doc);

  try {
    await Model.updateOne(
      { _id: doc._id, status: raw },
      {
        $set: {
          status: "expired",
          ...(expireAt ? { expiresAt: expireAt } : {}),
        },
      },
    );
  } catch {
    // best effort
  }

  return effectiveStatus;
}