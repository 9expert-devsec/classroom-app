import { headers } from "next/headers";
import Link from "next/link";
import ClassesListClient from "./ClassesListClient";

/* --------- helper หา origin ปัจจุบัน --------- */
async function getOrigin() {
  const env = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("host");
  const proto =
    h.get("x-forwarded-proto") ||
    (process.env.NODE_ENV === "development" ? "http" : "https");
  return `${proto}://${host}`;
}

/* --------- fetch รายการ class --------- */
async function fetchClasses() {
  const origin = await getOrigin();

  const res = await fetch(`${origin}/api/admin/classes`, {
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("fetch /api/admin/classes failed");
    return { items: [], total: 0 };
  }

  const data = await res.json();
  const items =
    data.items || data.data || (Array.isArray(data) ? data : []);
  return { items, total: data.total || items.length };
}

export default async function ClassesPage() {
  const { items, total } = await fetchClasses();

  return (
    <div className="space-y-4">
      {/* หัวข้อ + ปุ่มด้านขวาบน */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Class ทั้งหมด</h1>
          <p className="text-sm text-admin-textMuted">
            เลือก Class เพื่อดูรายชื่อนักเรียนและสถานะเช็คอิน
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* ปุ่ม Import จาก schedule */}
          <Link
            href="/admin/classroom/classes/from-schedule"
            className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-medium text-[#0A1F33] hover:bg-brand-primary/90"
          >
            Import Class จาก Schedule
          </Link>
        </div>
      </div>

      <ClassesListClient initialClasses={items} total={total} />
    </div>
  );
}
