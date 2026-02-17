"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AnimatedCheck from "@/components/icons/check-success";

function clean(x) {
  return String(x || "").trim();
}

export default function ReceiveCustomerCompleteClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const docId = clean(sp.get("docId"));
  const name = clean(sp.get("name"));

  const [sec, setSec] = useState(5);

  useEffect(() => {
    const t = setInterval(() => setSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (sec === 0) router.replace("/classroom/receive/customer");
  }, [sec, router]);

  const subtitle = useMemo(() => {
    const a = [];
    if (name) a.push(name);
    if (docId) a.push(docId);
    return a.length ? a.join(" • ") : "";
  }, [name, docId]);

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <div className="rounded-2xl border border-admin-border bg-white p-8 text-center">
        <div className="p-6">
          <AnimatedCheck size={140} className="mx-auto" />
        </div>

        <h1 className="mt-4 text-lg font-semibold text-admin-text">
          รับเอกสารสำเร็จ
        </h1>

        <div className="mt-1 text-sm text-admin-textMuted">
          ระบบบันทึกการรับเอกสารเรียบร้อยแล้ว
        </div>

        {subtitle ? (
          <div className="mt-2 text-sm font-medium text-admin-text">{subtitle}</div>
        ) : null}

        <div className="mt-6 text-sm text-admin-textMuted">
          กลับหน้าค้นหาใน {sec} วินาที...
        </div>

        <button
          type="button"
          onClick={() => router.replace("/classroom/receive/customer")}
          className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white hover:bg-brand-primary/90"
        >
          กลับหน้าค้นหาเอกสาร
        </button>
      </div>
    </div>
  );
}
