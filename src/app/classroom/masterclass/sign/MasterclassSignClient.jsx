// src/app/classroom/masterclass/sign/MasterclassSignClient.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MasterclassStepHeader from "../MasterclassStepHeader";
import UserButton from "@/components/ui/UserButton";
import SignaturePad from "@/components/shared/SignaturePad";
import { kioskFetch } from "@/lib/kioskFetch";

function pick(sp, key) {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

export default function MasterclassSignClient({ searchParams = {} }) {
  const router = useRouter();

  const studentId =
    pick(searchParams, "studentId") || pick(searchParams, "sid");
  const classId =
    pick(searchParams, "classId") || pick(searchParams, "classid");
  const day = Number(pick(searchParams, "day") || 1);

  const [signature, setSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  function handleSignatureChange(base64) {
    setSignature(base64);
  }

  // ------- โหลด preview ข้อมูลผู้เรียน (Masterclass ไม่มีอาหาร) -------
  useEffect(() => {
    if (!studentId) return;

    async function loadPreview() {
      setLoadingPreview(true);
      try {
        const params = new URLSearchParams();
        params.set("studentId", studentId);
        if (classId) params.set("classId", classId);
        params.set("day", String(day));

        const res = await kioskFetch(`/api/checkin/preview?${params.toString()}`);
        if (!res.ok) {
          console.error("preview error", res.status);
          setPreview(null);
          return;
        }
        const data = await res.json();
        setPreview(data);
      } catch (e) {
        console.error("preview fetch fail", e);
        setPreview(null);
      } finally {
        setLoadingPreview(false);
      }
    }

    loadPreview();
  }, [studentId, classId, day]);

  async function handleSubmit() {
    if (!studentId || !classId) {
      alert("ไม่พบข้อมูลผู้เรียนหรือ classId");
      return;
    }
    if (!signature) {
      alert("กรุณาเซ็นลายเซ็นก่อน");
      return;
    }

    setSubmitting(true);

    try {
      // 1) บันทึกลายเซ็นเข้า Student
      const resSign = await kioskFetch("/api/checkin/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          signature,
        }),
      });
      const dataSign = await resSign.json();
      if (!resSign.ok) {
        console.error("sign error:", dataSign);
        throw new Error(dataSign.error || "sign failed");
      }

      // 2) สร้าง / อัปเดต Checkin (ตัวเดียวกับ flow ปกติ → admin ได้ notification)
      const resComplete = await kioskFetch("/api/checkin/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          classId,
          day,
        }),
      });
      const dataComplete = await resComplete.json();
      if (!resComplete.ok) {
        console.error("complete error:", dataComplete);
        throw new Error(dataComplete.error || "complete checkin failed");
      }

      // 3) ไปหน้า success (พา classId/day ไปด้วย เพื่อวนกลับ Step 1 ของคลาสเดิม)
      const qs = new URLSearchParams();
      qs.set("sid", studentId);
      qs.set("classId", classId);
      qs.set("day", String(day));
      router.push(`/classroom/masterclass/success?${qs.toString()}`);
    } catch (err) {
      console.error(err);
      alert("บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  const user = preview?.user;
  const classInfo = preview?.classInfo;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {(submitting || loadingPreview) && (
        <div className="absolute inset-0 z-[50] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
        </div>
      )}

      <MasterclassStepHeader currentStep={2} />

      <div className="flex min-h-0 flex-1 flex-col px-6 py-6">
        <h2 className="sm:text-2xl lg:text-lg font-semibold">
          Step 2: เซ็นลายเซ็น
        </h2>
        <p className="mt-1 sm:text-base lg:text-sm text-front-textMuted">
          กรุณาเซ็นชื่อของท่านในพื้นที่ด้านล่าง
        </p>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-2 flex flex-col gap-2">
          {/* --------- กล่องสรุปข้อมูลผู้เรียน --------- */}
          <div className=" rounded-2xl border border-brand-border bg-white px-4 py-3 text-sm shadow-sm">
            <h3 className="mb-2 sm:text-xl lg:text-base font-semibold">
              สรุปข้อมูลผู้เรียน
            </h3>

            <div className="grid grid-cols-2 gap-2">
              {/* ผู้เรียน */}
              <div className="border-b border-dashed border-brand-border/60 pb-2 mb-2">
                <div className="sm:text-lg lg:text-sm font-semibold text-front-textMuted">
                  ผู้เรียน
                </div>
                <div className="mt-1 sm:text-lg lg:text-sm leading-snug">
                  <div>
                    ชื่อผู้เรียน:{" "}
                    <span className="font-medium">
                      {user?.studentName || user?.engName || "-"}
                    </span>
                  </div>
                  <div>
                    องค์กร:{" "}
                    <span className="font-medium">{user?.company || "-"}</span>
                  </div>
                </div>
              </div>

              {/* ข้อมูลคลาส */}
              <div className="border-b border-dashed border-brand-border/60 pb-2 mb-2">
                <div className="sm:text-lg lg:text-sm font-semibold text-front-textMuted">
                  ข้อมูลคลาส
                </div>
                {classInfo ? (
                  <div className="mt-1 sm:text-lg lg:text-sm leading-snug">
                    <div>
                      วิชา:{" "}
                      <span className="font-medium">
                        {classInfo.courseName || "-"}
                      </span>
                    </div>
                    <div>
                      วันนี้คือ:{" "}
                      <span className="font-medium">
                        {classInfo.dayLabel || ""}{" "}
                        {classInfo.dayDate ? `(${classInfo.dayDate})` : ""}
                      </span>
                    </div>
                    <div>
                      สถานที่:{" "}
                      <span className="font-medium">
                        {classInfo.room || "-"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-[13px] text-front-textMuted">
                    ยังไม่มีข้อมูลคลาสสำหรับการเช็คอินนี้
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* พื้นที่เซ็นลายเซ็น */}
          <div className="mt-4">
            <SignaturePad onChange={handleSignatureChange} />
          </div>
        </div>

        {/* ปุ่ม Back & ยืนยัน */}
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() =>
              router.push(
                `/classroom/masterclass/checkin?classId=${classId}&day=${day}`,
              )
            }
            className="w-80 shrink-0 rounded-2xl border border-brand-border bg-white px-4 py-2 sm:text-lg lg:text-sm font-medium text-front-text hover:bg-front-bgSoft"
          >
            ← ย้อนกลับ
          </button>

          <UserButton
            className="flex-1 w-full"
            onClick={handleSubmit}
            disabled={submitting || !signature}
          >
            ยืนยัน
          </UserButton>
        </div>
      </div>
    </div>
  );
}
