// src/app/api/admin/food/days/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import FoodDaySet from "@/models/FoodDaySet";
import Restaurant from "@/models/Restaurant";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import { toBkkYMD } from "@/lib/lunchConfig";
import { isYMD, bangkokDayStartUTC } from "@/lib/classDates";

export const dynamic = "force-dynamic";

const MODES = ["set", "coupon", "closed"];

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function safeAudit(payload) {
  try {
    await writeAuditLog(payload);
  } catch (e) {
    console.error("writeAuditLog failed:", e);
  }
}

// รับได้ทั้ง "YYYY-MM-DD" ตรง ๆ และ Date/ISO (แปลงเป็นวันไทย)
function toDayYMD(input) {
  const s = String(input || "").trim();
  if (isYMD(s)) return s;
  const ymd = toBkkYMD(s);
  return isYMD(ymd) ? ymd : "";
}

// GET /api/admin/food/days?month=2025-12
export async function GET(req) {
  try {
    await requirePerm(PERM.FOOD_READ);
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // "YYYY-MM"

    // ✅ P1c: กรองด้วย prefix ของ dayYMD แทนช่วง date
    //    (date มี 2 encoding การใช้ $gte/$lt จึงคาบเกี่ยวข้ามเดือน)
    //    เอกสารที่ถูก supersede ไม่มี dayYMD จึงหลุดออกไปเองอยู่แล้ว
    const filter = { dayYMD: { $exists: true, $nin: [null, ""] } };

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      filter.dayYMD = { $regex: `^${month}-` };
    }

    const docs = await FoodDaySet.find(filter)
      .sort({ dayYMD: 1 })
      .populate("entries.restaurant", "name logoUrl couponEnabled usesCouponStock")
      .populate("entries.set", "name")
      .lean();

    const items = docs.map((doc) => ({
      _id: doc._id,
      dayYMD: doc.dayYMD,
      date: doc.date, // คงไว้เพื่อ backward compat
      items: (doc.entries || []).map((en) => ({
        restaurant: en.restaurant,
        set: en.set || null,
        mode: en.mode || "set",
      })),
    }));

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}

// POST /api/admin/food/days
// body: { date: "YYYY-MM-DD" | ISO, items: [{ restaurantId, setId, mode }] }
export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const { date, items } = body || {};

    if (!date) return jsonError("กรุณาระบุวันที่", 400);

    const dayYMD = toDayYMD(date);
    if (!dayYMD) return jsonError("รูปแบบวันที่ไม่ถูกต้อง", 400);

    const rawItems = Array.isArray(items) ? items : [];

    // ---- validate ----
    const seen = new Set();
    const cleaned = [];

    for (const it of rawItems) {
      const restaurantId = String(it?.restaurantId || "").trim();
      if (!restaurantId) continue;

      if (seen.has(restaurantId)) {
        return jsonError("มีร้านซ้ำกันในวันเดียวกัน", 400);
      }
      seen.add(restaurantId);

      const mode = String(it?.mode || "set").trim();
      if (!MODES.includes(mode)) {
        return jsonError(`โหมดไม่ถูกต้อง: ${mode}`, 400);
      }

      cleaned.push({ restaurantId, mode, setId: it?.setId || null });
    }

    if (cleaned.length > 0) {
      const ids = cleaned.map((c) => c.restaurantId);
      const rests = await Restaurant.find({ _id: { $in: ids } })
        .select("name couponEnabled")
        .lean();
      const byId = new Map(rests.map((r) => [String(r._id), r]));

      for (const c of cleaned) {
        const r = byId.get(c.restaurantId);
        if (!r) return jsonError("ไม่พบร้านอาหารที่เลือก", 400);

        // คูปองได้เฉพาะร้านที่เปิดให้ใช้คูปอง
        if (c.mode === "coupon" && !r.couponEnabled) {
          return jsonError(
            `ร้าน "${r.name}" ยังไม่ได้เปิดให้เลือกเป็นร้านคูปอง`,
            400,
          );
        }
      }
    }

    // coupon / closed ไม่มีเซ็ตเมนู
    const entries = cleaned.map((c) => ({
      restaurant: c.restaurantId,
      mode: c.mode,
      set: c.mode === "set" ? c.setId || null : null,
    }));

    const before = await FoodDaySet.findOne({ dayYMD }).lean();

    // ✅ upsert ด้วย dayYMD; date เขียนเฉพาะตอนสร้างใหม่ ($setOnInsert)
    //    เอกสารเดิมจะไม่ถูกแตะ date เด็ดขาด
    const doc = await FoodDaySet.findOneAndUpdate(
      { dayYMD },
      {
        $set: { entries },
        $setOnInsert: {
          dayYMD,
          date: bangkokDayStartUTC(dayYMD),
          supersededBy: null,
        },
      },
      { upsert: true, new: true },
    );

    await safeAudit({
      ctx,
      req,
      action: before ? "update" : "create",
      entityType: "FoodDaySet",
      entityId: String(doc._id),
      entityLabel: dayYMD,
      before: before
        ? {
            entries: (before.entries || []).map((e) => ({
              restaurant: String(e.restaurant),
              mode: e.mode || "set",
              set: e.set ? String(e.set) : null,
            })),
          }
        : null,
      after: {
        entries: entries.map((e) => ({
          restaurant: String(e.restaurant),
          mode: e.mode,
          set: e.set ? String(e.set) : null,
        })),
      },
      meta: { dayYMD },
    });

    return NextResponse.json({ ok: true, item: doc });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
