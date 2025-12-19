// src/app/admin/classroom/classes/[id]/SyncStudentsButton.jsx
"use client";

import { useRouter } from "next/navigation";
import PrimaryButton from "@/components/ui/PrimaryButton";

export default function SyncStudentsButton({ classId }) {
  const router = useRouter();

  function handleGoImport() {
    if (!classId) return;

    // ✅ พาไปหน้า import โดยพ่วง classId ไปด้วย
    router.push(`/admin/classroom/import?classId=${classId}`);
  }

  return (
    <PrimaryButton
      type="button"
      className="px-3 py-1.5"
      onClick={handleGoImport}
    >
      นำเข้ารายชื่อ
    </PrimaryButton>
  );
}
