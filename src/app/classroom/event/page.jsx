// src/app/classroom/event/page.jsx
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function EventHomePage() {
  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/classroom"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-admin-border bg-white text-admin-text hover:bg-admin-surfaceMuted"
          aria-label="ย้อนกลับ"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>

        <div>
          <div className="text-[11px] uppercase tracking-wide text-admin-textMuted">
            Event
          </div>
          <h1 className="text-lg font-semibold text-admin-text">
            ลงทะเบียนเข้าร่วมกิจกรรม
          </h1>
          <div className="text-sm text-admin-textMuted">
            หน้าเตรียมทำ (Event check-in)
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-admin-border bg-white p-5 text-sm text-admin-textMuted">
        TODO: ทำระบบ create event ในฝั่ง admin +
        หน้างานสำหรับลงทะเบียนเข้าร่วมกิจกรรม
      </div>
    </div>
  );
}
