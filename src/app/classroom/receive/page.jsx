// src/app/classroom/receive/page.jsx
import Link from "next/link";
import { FileSignature, Users, ArrowRight, ChevronLeft } from "lucide-react";

function CardLink({ href, title, desc, Icon }) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-admin-border bg-white p-5 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-admin-surfaceMuted text-admin-text">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-semibold text-admin-text">{title}</div>
            <div className="mt-1 text-xs leading-5 text-admin-textMuted">
              {desc}
            </div>
          </div>
        </div>
        <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-admin-border bg-white text-admin-text transition group-hover:bg-admin-surfaceMuted">
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

export default function ReceiveIndexPage() {
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
            Receive
          </div>
          <h1 className="text-lg font-semibold text-admin-text">รับเอกสาร</h1>
          <div className="text-sm text-admin-textMuted">
            เลือกโหมดการรับเอกสาร
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CardLink
          href="/classroom/receive/customer"
          title="ลูกค้ารับเอกสาร"
          desc="กรอกเลขที่ QT/IV/RP → เลือกผู้รับ → เซ็นรับเอกสาร"
          Icon={FileSignature}
        />

        <CardLink
          href="/classroom/receive/staff"
          title="เจ้าหน้าที่รับเอกสารจากลูกค้า"
          desc="โหมด 3.2 (กำลังทำ) — เลือกเอกสารที่ลูกค้าส่ง + เซ็น 2 ฝ่าย"
          Icon={Users}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-admin-border bg-admin-surface p-4 text-xs text-admin-textMuted">
        หมายเหตุ: ตอนนี้ระบบหลักอยู่ที่ “ลูกค้ารับเอกสาร” ก่อน (3.1)
      </div>
    </div>
  );
}
