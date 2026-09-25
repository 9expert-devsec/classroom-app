// src/app/api/kiosk/close/route.js
//
// Close the kiosk on this device (L2a): revoke the session if there is one and
// always clear the cookie, even when the token is already invalid.
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import KioskSession from "@/models/KioskSession";
import { writeAuditLog } from "@/lib/auditLog.server";
import { KIOSK_COOKIE_NAME, verifyKioskToken } from "@/lib/kioskToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const token = req.cookies.get(KIOSK_COOKIE_NAME)?.value || "";

  let sid = "";
  if (token) {
    try {
      ({ sid } = await verifyKioskToken(token));
    } catch {
      sid = "";
    }
  }

  if (sid) {
    try {
      await dbConnect();
      const session = await KioskSession.findOneAndUpdate(
        { sid, revokedAt: null },
        {
          revokedAt: new Date(),
          revokedBy: null,
          revokedByName: "",
          revokeReason: "closed on device",
        },
        { new: true },
      ).lean();

      if (session) {
        await writeAuditLog({
          ctx: {
            user: {
              id: String(session.openedBy || ""),
              name: `kiosk: ${session.label}`,
            },
          },
          req,
          action: "kiosk.close",
          entityType: "kiosk",
          entityId: String(session._id),
          entityLabel: session.label,
          meta: {
            label: session.label,
            openedByName: session.openedByName,
            reason: "closed on device",
          },
        });
      }
    } catch (e) {
      console.warn("[kiosk] close failed:", e?.message || e);
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(KIOSK_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
