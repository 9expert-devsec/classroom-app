// src/app/classroom/layout.jsx
//
// L2a: every /classroom page needs a live kiosk session. The middleware has
// already checked the token's signature and expiry; this checks the DB too, so
// a revoked session is refused on the next full page load.
//
// /classroom/login is left unguarded by an explicit check: the middleware
// always sets x-classroom-path (overwriting anything the client sent) for
// /classroom routes, and the login path is skipped here.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireKiosk } from "@/lib/kioskAuth.server";
import { safeKioskNext } from "@/lib/kioskToken";
import NoBackForwardCache from "./NoBackForwardCache";

export const dynamic = "force-dynamic";

const LOGIN_PATH = "/classroom/login";

export default async function ClassroomLayout({ children }) {
  const path = headers().get("x-classroom-path") || "";
  if (path === LOGIN_PATH) return children;

  let ok = false;
  try {
    await requireKiosk();
    ok = true;
  } catch {
    ok = false;
  }

  // redirect() throws, so it stays outside the try above
  if (!ok) {
    redirect(`${LOGIN_PATH}?next=${encodeURIComponent(safeKioskNext(path))}`);
  }

  return (
    <>
      <NoBackForwardCache />
      {children}
    </>
  );
}
