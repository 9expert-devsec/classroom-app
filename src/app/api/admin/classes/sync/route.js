// src/app/api/admin/classes/sync/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Class from "@/models/Class";

/* ---------- helpers ---------- */

function getDateObj(x) {
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDDMMYY_BE(dateInput) {
  const d = getDateObj(dateInput);
  if (!d) return "00-00-00";
  const beYear = d.getFullYear() + 543;
  const yy = String(beYear).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yy}`;
}

function normalizeCourseCode(code) {
  return String(code || "CLASS")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");
}

function pickTypePrefix(sc) {
  const raw = String(
    sc?.trainingType ||
      sc?.classType ||
      sc?.type ||
      sc?.mode ||
      sc?.format ||
      sc?.delivery ||
      sc?.deliveryType ||
      "",
  )
    .trim()
    .toLowerCase();

  if (raw.includes("hybrid") || raw === "h") return "H";
  if (raw.includes("classroom") || raw.includes("on-site") || raw === "cr")
    return "CR";

  return "CR";
}

function pickChannelPrefix(sc) {
  const raw = String(sc?.channel || sc?.channelCode || sc?.audience || "")
    .trim()
    .toUpperCase();
  return raw || "PUB";
}

function buildTitlePrefix(sc) {
  const type = pickTypePrefix(sc); // CR/H
  const channel = pickChannelPrefix(sc); // PUB

  const courseCode =
    sc?.course?.course_id || sc?.course_id || sc?.courseCode || sc?.code || "";
  const safeCode = normalizeCourseCode(courseCode);

  // ในไฟล์นี้ schedule ใช้ sc.date (จากโค้ดเดิม)
  const dt = toDDMMYY_BE(sc?.date);

  // CR-PUB-MSE-L6-23-02-69
  return `${type}-${channel}-${safeCode}-${dt}`;
}

function parseRunFromTitle(title) {
  const s = String(title || "").trim();
  const parts = s.split("-");
  const last = parts[parts.length - 1];
  const n = Number(last);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function nextRunNumber(titlePrefix) {
  // ดึง class ที่ขึ้นต้นด้วย prefix- แล้วหา run max+1
  const rows = await Class.find(
    { title: { $regex: `^${escapeRegExp(titlePrefix)}-` } },
    { title: 1 },
  )
    .lean()
    .limit(500);

  let maxRun = 0;
  for (const r of rows) {
    const run = parseRunFromTitle(r?.title);
    if (run && run > maxRun) maxRun = run;
  }
  return maxRun + 1 || 1;
}

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ---------- Route ---------- */

export async function GET() {
  await dbConnect();

  const API_URL = process.env.AI_API_BASE
    ? `${process.env.AI_API_BASE.replace(/\/+$/, "")}/schedule`
    : "https://9exp-sec.com/api/ai/schedule";

  const API_KEY = process.env.AI_API_KEY || "";

  if (!API_KEY) {
    return NextResponse.json(
      { ok: false, error: "Missing AI_API_KEY in env" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(API_URL, {
      headers: { "x-api-key": API_KEY },
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    if (!data?.ok) {
      return NextResponse.json(
        { ok: false, error: "API schedule error", debug: data },
        { status: 400 },
      );
    }

    const items = Array.isArray(data.items) ? data.items : [];

    // (เดิม) filter เฉพาะ "พรุ่งนี้"
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    const tomorrowSchedules = items
      .filter((item) => String(item?.date || "").split("T")[0] === tomorrowDate)
      // ✅ sort ใกล้ -> ไกล
      .sort((a, b) => {
        const da = getDateObj(a?.date)?.getTime() || 0;
        const db = getDateObj(b?.date)?.getTime() || 0;
        return da - db;
      });

    const created = [];

    for (const sc of tomorrowSchedules) {
      // กันซ้ำ
      const exists = await Class.findOne({ scheduleId: sc._id }).lean();
      if (exists) continue;

      // ✅ สร้าง title ตามแพทเทิร์นใหม่ + run
      const prefix = buildTitlePrefix(sc);
      const run = await nextRunNumber(prefix);
      const title = `${prefix}-${run}`;

      const newClass = await Class.create({
        scheduleId: sc._id,
        title,
        date: sc.date,
        room: sc.room || "",
        instructors: sc.instructors || [],
        duration: {
          dayCount: sc.dayCount || 1,
          startTime: sc.startTime || "09:00",
          endTime: sc.endTime || "16:00",
        },
        source: "sync",
      });

      created.push(newClass);
    }

    return NextResponse.json({
      ok: true,
      createdCount: created.length,
      items: created,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 },
    );
  }
}
