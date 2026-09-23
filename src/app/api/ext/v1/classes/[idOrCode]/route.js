// src/app/api/ext/v1/classes/[idOrCode]/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongoose";
import Class from "@/models/Class";
import {
  corsPreflight,
  externalBaseUrl,
  externalError,
  guardExternalRequest,
  withCors,
} from "@/lib/externalAuth.server";
import { serializeClasses } from "@/lib/externalClass.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "classes.read";

const PROJECTION = {
  title: 1,
  courseCode: 1,
  courseName: 1,
  customCourseName: 1,
  classImageUrl: 1,
  date: 1,
  days: 1,
  duration: 1,
  program: 1,
  room: 1,
  trainingType: 1,
  channel: 1,
  instructors: 1,
  updatedAt: 1,
};

function clean(x) {
  return String(x ?? "").trim();
}

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function OPTIONS(req) {
  return corsPreflight(req);
}

export async function GET(req, { params }) {
  try {
    await dbConnect();

    const guard = await guardExternalRequest(req, { scope: SCOPE });
    if (guard.error) return guard.error;

    const key = clean(params?.idOrCode);
    if (!key) {
      return withCors(
        externalError(400, "bad_request", "missing class id or class_name"),
        guard.cors,
      );
    }

    // Accept a Mongo _id or a class_name (title, case-insensitive exact).
    let doc = null;

    if (mongoose.Types.ObjectId.isValid(key)) {
      doc = await Class.findById(key, PROJECTION).lean();
    }

    if (!doc) {
      doc = await Class.findOne(
        { title: new RegExp(`^${escapeRegExp(key)}$`, "i") },
        PROJECTION,
      ).lean();
    }

    if (!doc) {
      return withCors(
        externalError(404, "class_not_found", `No class matches "${key}"`),
        guard.cors,
      );
    }

    const [item] = await serializeClasses([doc], {
      includeSignature: new URL(req.url).searchParams.get("signature") !== "0",
      baseUrl: externalBaseUrl(),
      keyId: String(guard.keyDoc._id),
    });

    return withCors(
      NextResponse.json({ ok: true, version: "v1", item }),
      guard.cors,
    );
  } catch (e) {
    console.error("ext/v1/classes/[idOrCode]:", e?.message || e);
    return externalError(500, "server_error", "Internal server error");
  }
}
