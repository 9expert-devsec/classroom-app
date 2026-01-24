// src/app/classroom/page.jsx
import Link from "next/link";
import {
  CheckCircle2,
  FileSignature,
  CalendarPlus,
  UserCog,
  ArrowRight,
} from "lucide-react";

function CardLink({ href, title, desc, Icon }) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-admin-border bg-white p-5 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
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

      {/* subtle hover bg */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-brand-primary/10" />
        <div className="absolute -left-24 -bottom-24 h-48 w-48 rounded-full bg-brand-primary/10" />
      </div>
    </Link>
  );
}

export default function ClassroomHomePage() {
  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <div className="mb-5">
        <div className="text-[11px] uppercase tracking-wide text-admin-textMuted">
          Classroom
        </div>
        <h1 className="mt-1 text-xl font-semibold text-admin-text">
          เมนูหน้างาน
        </h1>
        <p className="mt-1 text-sm text-admin-textMuted">
          เลือกประเภทงานที่ต้องการทำ
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CardLink
          href="/classroom/checkin"
          title="ลงทะเบียนเข้าเรียน"
          desc="ค้นหาชื่อผู้เข้าอบรม → เลือกคลาส → เช็กอิน + ลายเซ็น"
          Icon={CheckCircle2}
        />

        <CardLink
          href="/classroom/receive"
          title="รับเอกสาร"
          desc="กรอกเลขที่ QT/IV/RP → เลือกผู้รับ → เซ็นรับเอกสาร"
          Icon={FileSignature}
        />

        <CardLink
          href="/classroom/event"
          title="ลงทะเบียนเข้าร่วมกิจกรรม"
          desc="โหมดกิจกรรม (Event) — เตรียมทำระบบสร้างกิจกรรม + เช็กอิน"
          Icon={CalendarPlus}
        />

        <CardLink
          href="/classroom/edit-user"
          title="แก้ไขข้อมูลลงทะเบียนเข้าเรียน"
          desc="ค้นหาผู้ที่เช็กอินแล้ว → แก้ไขข้อมูล (เช่น อาหาร) → ยืนยัน"
          Icon={UserCog}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-admin-border bg-admin-surface p-4 text-xs text-admin-textMuted">
        Tips: หน้านี้ไว้เป็น “ทางเข้าเดียว” ให้ทีมหน้างานใช้งานได้เร็ว
        ลดการพิมพ์ URL ผิด
      </div>
    </div>
  );
}
