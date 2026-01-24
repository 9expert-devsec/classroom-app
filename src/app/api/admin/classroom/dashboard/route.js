// src/app/api/admin/classroom/dashboard/route.js
import { getClassroomDashboardData } from "@/lib/classroomDashboard.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const range = String(searchParams.get("range") || "today");

  const data = await getClassroomDashboardData(range).catch((e) => ({
    ok: false,
    error: String(e?.message || e),
  }));

  return Response.json(data);
}
