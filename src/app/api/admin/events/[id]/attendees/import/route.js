import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Event from "@/models/Event";
import EventAttendee from "@/models/EventAttendee";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";

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

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function safeAudit(payload) {
  try {
    await writeAuditLog(payload);
  } catch (e) {
    console.warn("[audit] writeAuditLog failed:", e?.message || e);
  }
}

export async function POST(req, { params }) {
  try {
    const adminCtx = await requirePerm(PERM.EVENTS_IMPORT);
    await dbConnect();

    const p = await Promise.resolve(params); // ✅ รองรับ Next params Promise
    const eventId = String(p?.id || "");

    const ev = await Event.findById(eventId).select("_id title startAt").lean();
    if (!ev) return jsonError("event not found", 404);

    const body = await req.json().catch(() => ({}));
    const mode = clean(body.mode) || "validate"; // validate | import
    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (!rows.length) return jsonError("no rows", 400);

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
    if (names.length)
      or.push({ fullName: { $in: Array.from(new Set(names)) } });

    let existing = [];
    if (or.length) {
      existing = await EventAttendee.find({ eventId, $or: or })
        .select("fullName phone email")
        .lean();
    }

    const dbEmail = new Set(existing.map((x) => normEmail(x.email)));
    const dbPhone = new Set(existing.map((x) => normPhone(x.phone)));
    const dbName = new Set(existing.map((x) => normSpaces(x.fullName)));

    for (const x of normalized) {
      const e = x.doc.email;
      const p2 = x.doc.phone;
      const n = x.doc.fullName;

      let dup = false;
      if (e && dbEmail.has(normEmail(e))) dup = true;
      if (!dup && p2 && dbPhone.has(normPhone(p2))) dup = true;
      if (!dup && !e && !p2 && n && dbName.has(normSpaces(n))) dup = true;

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
    let importError = "";

    if (toInsert.length) {
      try {
        const created = await EventAttendee.insertMany(toInsert, {
          ordered: false,
        });
        createdCount = Array.isArray(created) ? created.length : 0;
      } catch (e) {
        // ordered:false อาจ insert บางส่วนแล้ว throw
        createdCount =
          Number(e?.result?.nInserted) || Number(e?.insertedDocs?.length) || 0;
        importError = String(e?.message || e);
      }
    }

    // ✅ Audit: import attendees (log เฉพาะ summary/counts)
    await safeAudit({
      ctx: adminCtx,
      req,
      action: "custom",
      entityType: "import",
      entityId: `${eventId}__attendees`,
      entityLabel: `${clean(ev?.title) || "Event"} • import attendees`,
      before: null,
      after: {
        eventId,
        createdCount,
        skippedCount: summary.skipped,
        summary,
      },
      meta: {
        eventId,
        eventTitle: clean(ev?.title),
        mode,
        createdCount,
        skippedCount: summary.skipped,
        importError: importError || undefined,
      },
    });

    return NextResponse.json({
      ok: true,
      summary,
      createdCount,
      skippedCount: summary.skipped,
      importError: importError || undefined,
    });
  } catch (e) {
    return jsonError(String(e?.message || e), e?.status || 500);
  }
}
