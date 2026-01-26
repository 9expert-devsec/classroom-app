import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Event from "@/models/Event";
import EventAttendee from "@/models/EventAttendee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(s) {
  return String(s || "").trim();
}
function normSpaces(s) {
  return clean(s).replace(/\s+/g, " ");
}
function normEmail(s) {
  return clean(s).toLowerCase();
}
function normPhone(s) {
  return clean(s).replace(/\D/g, "");
}
function makeKey({ fullName, phone, email }) {
  const n = normSpaces(fullName);
  const p = normPhone(phone);
  const e = normEmail(email);
  return `n:${n}|p:${p}|e:${e}`;
}

function rowToDoc(row) {
  const fullName = normSpaces(row.fullName);
  const phone = normPhone(row.phone);
  const email = normEmail(row.email);
  const sourceChannel = normSpaces(row.sourceChannel);
  const gender = normSpaces(row.gender);
  const ageNum =
    row.age === null || row.age === undefined || row.age === ""
      ? null
      : Number(row.age);
  const age = Number.isFinite(ageNum) ? ageNum : null;
  const workStatus = normSpaces(row.workStatus);

  return { fullName, phone, email, sourceChannel, gender, age, workStatus };
}

function hasValue(x) {
  return clean(x) !== "";
}

export async function POST(req, { params }) {
  try {
    await dbConnect();

    const eventId = String(params?.id || "");
    const ev = await Event.findById(eventId).select("_id").lean();
    if (!ev) {
      return NextResponse.json(
        { ok: false, error: "event not found" },
        { status: 404 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const mode = clean(body.mode) || "validate"; // validate | import
    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (!rows.length) {
      return NextResponse.json(
        { ok: false, error: "no rows" },
        { status: 400 },
      );
    }

    // ---- normalize + basic validation + dedupe in file ----
    const fileSeen = new Set();
    const normalized = rows.map((r, idx) => {
      const doc = rowToDoc(r || {});
      const issues = [];
      if (!doc.fullName) issues.push("missing_fullName");

      const key = makeKey(doc);
      const dupInFile = fileSeen.has(key);
      if (!dupInFile) fileSeen.add(key);
      if (dupInFile) issues.push("duplicate_in_file");

      return {
        rowIndex: idx + 1,
        key,
        doc,
        issues,
        action: "pending",
        dupDb: false,
      };
    });

    // ---- check duplicates in DB (prefer email/phone) ----
    const emails = normalized.map((x) => x.doc.email).filter(hasValue);
    const phones = normalized.map((x) => x.doc.phone).filter(hasValue);
    const names = normalized.map((x) => x.doc.fullName).filter(hasValue);

    const or = [];
    if (emails.length) or.push({ email: { $in: Array.from(new Set(emails)) } });
    if (phones.length) or.push({ phone: { $in: Array.from(new Set(phones)) } });
    // name-only fallback (exact) — ใช้เพื่อกันซ้ำกรณีไม่มี email/phone
    if (names.length)
      or.push({ fullName: { $in: Array.from(new Set(names)) } });

    let existing = [];
    if (or.length) {
      existing = await EventAttendee.find({
        eventId,
        $or: or,
      })
        .select("fullName phone email")
        .lean();
    }

    const dbEmail = new Set(existing.map((x) => normEmail(x.email)));
    const dbPhone = new Set(existing.map((x) => normPhone(x.phone)));
    const dbName = new Set(existing.map((x) => normSpaces(x.fullName)));

    for (const x of normalized) {
      const e = x.doc.email;
      const p = x.doc.phone;
      const n = x.doc.fullName;

      let dup = false;
      if (e && dbEmail.has(normEmail(e))) dup = true;
      if (!dup && p && dbPhone.has(normPhone(p))) dup = true;

      // fallback: name dup only if no email/phone provided
      if (!dup && !e && !p && n && dbName.has(normSpaces(n))) dup = true;

      if (dup) {
        x.dupDb = true;
        x.issues.push("duplicate_in_db");
      }
    }

    // ---- decide action ----
    for (const x of normalized) {
      const hasHardError = x.issues.includes("missing_fullName");
      const isDup =
        x.issues.includes("duplicate_in_file") ||
        x.issues.includes("duplicate_in_db");
      x.action = hasHardError || isDup ? "skip" : "insert";
    }

    const summary = {
      total: normalized.length,
      insertable: normalized.filter((x) => x.action === "insert").length,
      skipped: normalized.filter((x) => x.action === "skip").length,
      dupInFile: normalized.filter((x) =>
        x.issues.includes("duplicate_in_file"),
      ).length,
      dupInDb: normalized.filter((x) => x.issues.includes("duplicate_in_db"))
        .length,
      missingName: normalized.filter((x) =>
        x.issues.includes("missing_fullName"),
      ).length,
    };

    if (mode !== "import") {
      return NextResponse.json({ ok: true, summary, items: normalized });
    }

    // ---- import only insertable ----
    const toInsert = normalized
      .filter((x) => x.action === "insert")
      .map((x) => ({
        eventId,
        ...x.doc,
        status: "registered",
      }));

    let createdCount = 0;
    if (toInsert.length) {
      const created = await EventAttendee.insertMany(toInsert, {
        ordered: false,
      });
      createdCount = Array.isArray(created) ? created.length : 0;
    }

    return NextResponse.json({
      ok: true,
      summary,
      createdCount,
      skippedCount: summary.skipped,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
