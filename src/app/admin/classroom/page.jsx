// src/app/admin/classroom/page.jsx
import ClassroomDashboardClient from "./ClassroomDashboardClient";
import { getClassroomDashboardData } from "@/lib/classroomDashboard.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGE_OPTIONS = [
  { key: "today", label: "วันนี้" },
  { key: "week", label: "7 วันล่าสุด" },
  { key: "month", label: "เดือนนี้" },
];

function getRangeLabel(range) {
  const found = RANGE_OPTIONS.find((r) => r.key === range);
  return found ? found.label : "วันนี้";
}

export default async function ClassroomDashboard({ searchParams }) {
  const range = searchParams?.range || "today";
  const rangeLabel = getRangeLabel(range);

  const initialData = await getClassroomDashboardData(range);

  return (
    <ClassroomDashboardClient
      range={range}
      rangeLabel={rangeLabel}
      initialData={initialData}
    />
  );
}
