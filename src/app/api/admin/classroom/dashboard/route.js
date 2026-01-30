// src/app/api/admin/classroom/dashboard/route.js
import { getClassroomDashboardData } from "@/lib/classroomDashboard.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseIncludeFromSearchParams(sp) {
  // ✅ รองรับ:
  // - ?include=cards,program
  // - ?include=cards&include=program
  const all = sp.getAll("include"); // array (อาจเป็น [])
  const parts = [];

  for (const v of all.length ? all : ["cards"]) {
    String(v || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((x) => parts.push(x));
  }

  // กันว่าง
  return parts.length ? parts : ["cards"];
}

export async function GET(req) {
  const u = new URL(req.url);
  const sp = u.searchParams;

  const range = String(sp.get("range") || "today");
  const include = parseIncludeFromSearchParams(sp); // ✅ ต้องเป็น array/string ไม่ใช่ Set
  const mode = String(sp.get("mode") || "");
  const from = String(sp.get("from") || "");
  const to = String(sp.get("to") || "");

  const data = await getClassroomDashboardData(range, {
    include, // ✅ เช่น ["cards","program"]
    mode,
    from,
    to,
    origin: u.origin,
    cookieHeader: req.headers.get("cookie") || "",
  }).catch((e) => ({
    ok: false,
    error: String(e?.message || e),
  }));

  return Response.json(data);
}
