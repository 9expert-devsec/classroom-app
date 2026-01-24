// src/app/classroom/edit-user/page.jsx
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function EditUserPage() {
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
            Edit User
          </div>
          <h1 className="text-lg font-semibold text-admin-text">
            แก้ไขข้อมูลลงทะเบียนเข้าเรียน
          </h1>
          <div className="text-sm text-admin-textMuted">
            หน้าเตรียมทำ (แก้ไขข้อมูลผู้ที่เช็กอินแล้ว)
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-admin-border bg-white p-5 text-sm text-admin-textMuted">
        TODO: Search ชื่อ (เฉพาะผู้ที่เช็กอินแล้ว) → แสดงสรุป → แก้ไขอาหาร →
        ยืนยัน
      </div>
    </div>
  );
}
