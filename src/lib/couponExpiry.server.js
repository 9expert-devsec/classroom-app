// src/lib/couponExpiry.server.js
function clean(x) {
  return String(x ?? "").trim();
}

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

  const dt = new Date(`${dayYMD}T15:00:00+07:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function isCouponExpired(doc, now = new Date()) {
  const expireAt = getCouponExpireAt(doc);
  if (!expireAt) return false;
  return expireAt.getTime() <= now.getTime();
}

export function getCouponEffectiveStatus(doc, now = new Date()) {
  const raw = clean(doc?.status || "issued");

  if (raw === "redeemed") return "redeemed";
  if (raw === "expired") return "expired";
  if (isCouponExpired(doc, now)) return "expired";

  return "issued";
}

export async function syncCouponExpiredStatus(Model, doc, now = new Date()) {
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
