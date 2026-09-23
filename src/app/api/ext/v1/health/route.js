// src/app/api/ext/v1/health/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import {
  corsPreflight,
  externalError,
  guardExternalRequest,
  withCors,
} from "@/lib/externalAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req) {
  return corsPreflight(req);
}

export async function GET(req) {
  try {
    await dbConnect();

    // Health requires a valid key but no particular scope.
    const guard = await guardExternalRequest(req);
    if (guard.error) return guard.error;

    return withCors(
      NextResponse.json({
        ok: true,
        service: "classroom-app external api",
        version: "v1",
        key: {
          name: guard.keyDoc.name,
          prefix: guard.keyDoc.keyPrefix,
          scopes: Array.isArray(guard.keyDoc.scopes) ? guard.keyDoc.scopes : [],
        },
        server_time: new Date().toISOString(),
      }),
      guard.cors,
    );
  } catch (e) {
    console.error("ext/v1/health:", e?.message || e);
    return externalError(500, "server_error", "Internal server error");
  }
}
