"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import AnimatedCheck from "@/components/icons/check-success";

function clean(x) {
  return String(x || "").trim();
}

export default function ReceiveStaffCompletePage() {
  const sp = useSearchParams();
  const docId = clean(sp.get("docId"));
  const name = clean(sp.get("name"));

  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => {
        const next = c - 1;
        if (next <= 0) {
          clearInterval(t);
          window.location.href = "/classroom/receive/staff";
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(t);
  }, []);

  const title = useMemo(() => {
    if (name) return `นำส่งเอกสารสำเร็จ: ${name}`;
    return "นำส่งเอกสารสำเร็จ";
  }, [name]);

  return (
    <div className="mx-auto w-full max-w-4xl p-6 h-[100svh] flex flex-col">
      <div className="flex-1 grid place-items-center">
        <div className="w-full rounded-2xl border border-admin-border bg-white p-6">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <div className="p-6">
              <AnimatedCheck size={140} className="mx-auto" />
            </div>

            <div className="text-lg font-semibold text-admin-text">{title}</div>

            <div className="mt-2 text-sm text-admin-textMuted">
              ระบบบันทึกการนำส่งเอกสารเรียบร้อยแล้ว
              {docId ? <div className="mt-1">เลขที่เอกสาร: {docId}</div> : null}
            </div>

            <div className="mt-6 text-sm text-admin-textMuted">
              กลับหน้าค้นหาใน {countdown} วินาที...
            </div>

            <Link
              href="/classroom/receive/staff"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white hover:bg-brand-primary/90"
            >
              กลับหน้ารับเอกสาร
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
