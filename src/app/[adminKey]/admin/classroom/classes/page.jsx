import Link from "next/link";
import ClassesListClient from "./ClassesListClient";
import { getBaseUrl } from "@/lib/baseUrl.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/* --------- fetch รายการ class --------- */
async function fetchClasses() {
  const origin = getBaseUrl();

  const res = await fetch(`${origin}/api/admin/classes`, {
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("fetch /api/admin/classes failed", res.status);
    return { items: [], total: 0 };
  }

  const data = await res.json().catch(() => ({}));
  const items = data.items || data.data || (Array.isArray(data) ? data : []);
  return { items, total: data.total || items.length };
}

export default async function ClassesPage() {
  const { items, total } = await fetchClasses();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Class ทั้งหมด</h1>
          <p className="text-sm text-admin-textMuted">
            เลือก Class เพื่อดูรายชื่อนักเรียนและสถานะเช็คอิน
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/a1exqwvCqTXP7s0/admin/classroom/classes/from-schedule"
            className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl bg-brand-primary text-xs font-medium text-white shadow-sm transition hover:bg-brand-primaryDark hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/70 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Import Class จาก Schedule
          </Link>
        </div>
      </div>

      <ClassesListClient initialClasses={items} total={total} />
    </div>
  );
}
