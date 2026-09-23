// src/app/api/ext/v1/signature/[token]/route.js
//
// Signed proxy for instructor signature images.
//
// This route deliberately requires NO x-api-key: the signed, short-lived token
// IS the credential. That lets a partner drop the URL straight into an
// <img src="..."> where custom headers are impossible, while the raw Cloudinary
// URL is never disclosed and access expires on its own.
import { NextResponse } from "next/server";
import {
  externalError,
  verifySignatureToken,
} from "@/lib/externalAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Max-Age": "600",
    },
  });
}

export async function GET(req, { params }) {
  try {
    const verified = verifySignatureToken(params?.token);

    if (!verified.ok) {
      return externalError(
        401,
        "signature_token_invalid",
        "Signature link is invalid or has expired",
      );
    }

    const upstream = await fetch(verified.url, { cache: "no-store" });

    if (!upstream.ok || !upstream.body) {
      console.error(
        "ext/v1/signature: upstream fetch failed",
        upstream.status,
      );
      return externalError(500, "server_error", "Unable to load signature");
    }

    // Prefer the real content type; fall back to PNG, the expected format.
    const upstreamType = String(upstream.headers.get("content-type") || "");
    const contentType = upstreamType.startsWith("image/")
      ? upstreamType
      : "image/png";

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": "inline",
      },
    });
  } catch (e) {
    console.error("ext/v1/signature:", e?.message || e);
    return externalError(500, "server_error", "Internal server error");
  }
}
