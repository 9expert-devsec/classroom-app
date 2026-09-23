// src/app/[adminKey]/admin/classroom/classes/page.jsx
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
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Class ทั้งหมด</h1>
          <p className="text-sm text-admin-textMuted">
            เลือก Class เพื่อดูรายชื่อนักเรียนและสถานะเช็คอิน
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/a1exqwvCqTXP7s0/admin/classroom/classes/from-schedule"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 text-xs font-medium text-white shadow-sm transition hover:bg-brand-primaryDark hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Import Class จาก Schedule
          </Link>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ClassesListClient initialClasses={items} total={total} />
      </div>
    </div>
  );
}
