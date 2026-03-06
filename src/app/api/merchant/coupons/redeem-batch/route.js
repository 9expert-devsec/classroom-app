import { NextResponse } from "next/server";
import mongoose from "mongoose";

import dbConnect from "@/lib/mongoose";
import CouponRecord from "@/models/CouponRecord";
import BillCounter from "@/models/BillCounter";
import { requireMerchant } from "@/lib/merchantAuth.server";
import { decryptCipher, sha256 } from "@/lib/couponCipher.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(x) {
  return String(x ?? "").trim();
}
function jsonError(error, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}
function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
function todayYMD_BKK(d = new Date()) {
  // en-CA => YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
function padLeft(n, width) {
  return String(n).padStart(width, "0");
}

export async function POST(req) {
  const me = await requireMerchant(req);
  if (me instanceof NextResponse) return me;

  const body = await req.json().catch(() => ({}));
  const cs = Array.isArray(body?.cs) ? body.cs : [];
  const billTotal = toNum(body?.billTotal);

  const ciphers = cs.map(clean).filter(Boolean);
  if (!ciphers.length) return jsonError("MISSING_CIPHERS");
  if (billTotal === null || billTotal < 0)
    return jsonError("INVALID_BILL_TOTAL");

  // decode -> tokenHash list
  let tokenHashes = [];
  try {
    tokenHashes = ciphers.map((c) => {
      const tokenRaw = decryptCipher(c);
      return sha256(tokenRaw);
    });
  } catch {
    return jsonError("BAD_CIPHER", 400);
  }

  await dbConnect();

  const now = new Date();
  const dayYMD = todayYMD_BKK(now);

  // กันซ้ำใน payload
  tokenHashes = Array.from(new Set(tokenHashes));

  // ต้อง issued, ยังไม่ผูก merchant, ไม่หมดอายุ, ร้านอยู่ใน allowedRestaurantIds (ถ้ามี)
  const baseMatch = {
    redeemTokenHash: { $in: tokenHashes },
    status: "issued",
    merchantId: null,
    $and: [
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      {
        $or: [
          { allowedRestaurantIds: { $exists: false } },
          { allowedRestaurantIds: { $size: 0 } },
          { allowedRestaurantIds: me.restaurantId },
        ],
      },
    ],
  };

  const session = await mongoose.startSession();

  try {
    let bill = null;

    await session.withTransaction(async () => {
      // 1) โหลดคูปองที่เข้าเงื่อนไข
      const rows = await CouponRecord.find(baseMatch)
        .session(session)
        .select("_id couponPrice redeemTokenHash displayCode")
        .lean();

      // ต้องเจอครบทุก tokenHashes ไม่งั้น fail ทั้งก้อน
      const foundHashes = new Set(rows.map((x) => x.redeemTokenHash));
      const missing = tokenHashes.filter((h) => !foundHashes.has(h));
      if (missing.length) {
        throw new Error("COUPON_NOT_AVAILABLE");
      }

      const couponTotal = rows.reduce((a, x) => {
        const p = Number(x.couponPrice ?? 180);
        return a + (Number.isFinite(p) ? p : 180);
      }, 0);

      const payMore = Math.max(0, billTotal - couponTotal);

      // 2) สร้าง billId + billCode แบบรันต่อวัน
      const counter = await BillCounter.findOneAndUpdate(
        { dayYMD },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session, setDefaultsOnInsert: true },
      ).lean();

      const seq = Number(counter?.seq || 1);
      const billId = new mongoose.Types.ObjectId();
      const billCode = `BILL-${dayYMD.replace(/-/g, "")}-${padLeft(seq, 4)}`;

      // 3) กัน report คูณซ้ำ: ลง spent/diff เฉพาะใบแรก
      const firstId = String(rows[0]?._id || "");

      const bulk = rows.map((x) => {
        const isFirst = String(x._id) === firstId;
        return {
          updateOne: {
            filter: { _id: x._id, status: "issued", merchantId: null },
            update: {
              $set: {
                status: "redeemed",
                merchantId: me.restaurantId,
                merchantUserId: me.userId,
                redeemedAt: now,

                // bill meta
                billId,
                billCode,
                billDayYMD: dayYMD,
                billTotal,
                billCouponTotal: couponTotal,
                billPayMore: payMore,
                billCouponCount: rows.length,

                // กัน sum คูณซ้ำ (รายใบ)
                spentAmount: isFirst ? billTotal : 0,
                diffAmount: isFirst ? payMore : 0,
              },
            },
          },
        };
      });

      const res = await CouponRecord.bulkWrite(bulk, { session });

      const modified = (res?.modifiedCount ?? 0) + (res?.nModified ?? 0);
      if (modified !== rows.length) {
        throw new Error("COUPON_NOT_AVAILABLE");
      }

      bill = {
        billId: String(billId),
        billCode,
        billDayYMD: dayYMD,
        billTotal,
        couponCount: rows.length,
        couponTotal,
        payMore,
        redeemedAt: now.toISOString(),
      };
    });

    return NextResponse.json({ ok: true, bill });
  } catch (e) {
    const msg = String(e?.message || "REDEEM_BATCH_FAILED");
    if (msg === "COUPON_NOT_AVAILABLE")
      return jsonError("COUPON_NOT_AVAILABLE", 409);
    return jsonError(msg, 500);
  } finally {
    session.endSession();
  }
}
