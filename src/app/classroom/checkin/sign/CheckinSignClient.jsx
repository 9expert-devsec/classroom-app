// src/app/classroom/checkin/sign/CheckinSignClient.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StepHeader from "../StepHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import SignaturePad from "../../../../components/shared/SignaturePad";

function pick(sp, key) {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

export default function SignPage({ searchParams = {} }) {
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

  // ------- โหลด preview ข้อมูลผู้เรียน + อาหาร -------
  useEffect(() => {
    if (!studentId) return;

    async function loadPreview() {
      setLoadingPreview(true);
      try {
        const params = new URLSearchParams();
        params.set("studentId", studentId);
        if (classId) params.set("classId", classId);
        params.set("day", String(day));

        const res = await fetch(`/api/checkin/preview?${params.toString()}`);
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
      const resSign = await fetch("/api/checkin/sign", {
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

      // 2) สร้าง / อัปเดต Checkin
      const resComplete = await fetch("/api/checkin/complete", {
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

      // 3) ไปหน้า success
      router.push(`/classroom/checkin/success?sid=${studentId}`);
    } catch (err) {
      console.error(err);
      alert("บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  const user = preview?.user;
  const classInfo = preview?.classInfo;
  const food = preview?.food;

  return (
    <div className="relative flex flex-col">
      {(submitting || loadingPreview) && (
        <div className="absolute inset-0 z-[50] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
        </div>
      )}

      <StepHeader currentStep={3} />

      <div className="px-6 py-6">
        <h2 className="text-lg font-semibold">Step 3: เซ็นลายเซ็น</h2>
        <p className="mt-2 text-sm text-front-textMuted">
          กรุณาเซ็นชื่อของท่านในพื้นที่ด้านล่าง
        </p>

        {/* --------- กล่องสรุปข้อมูลผู้เรียน & อาหาร --------- */}
        <div className="mt-4 rounded-2xl border border-brand-border bg-white px-4 py-3 text-sm shadow-sm">
          <h3 className="mb-2 text-[13px] font-semibold">
            สรุปข้อมูลผู้เรียน &amp; เมนูอาหาร
          </h3>

          {/* ผู้เรียน */}
          <div className="border-b border-dashed border-brand-border/60 pb-2 mb-2">
            <div className="text-[12px] font-semibold text-front-textMuted">
              ผู้เรียน
            </div>
            <div className="mt-1 text-[13px] leading-snug">
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
            <div className="text-[12px] font-semibold text-front-textMuted">
              ข้อมูลคลาส
            </div>
            {classInfo ? (
              <div className="mt-1 text-[13px] leading-snug">
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
                  ห้องอบรม:{" "}
                  <span className="font-medium">{classInfo.room || "-"}</span>
                </div>
              </div>
            ) : (
              <div className="mt-1 text-[13px] text-front-textMuted">
                ยังไม่มีข้อมูลคลาสสำหรับการเช็คอินนี้
              </div>
            )}
          </div>

          {/* เมนูอาหารที่เลือก */}
          <div>
            <div className="text-[12px] font-semibold text-front-textMuted">
              เมนูอาหารที่เลือก
            </div>
            {food ? (
              <div className="mt-1 text-[13px] leading-snug">
                <div>
                  ร้าน:{" "}
                  <span className="font-medium">
                    {food.restaurantName || "-"}
                  </span>
                </div>
                <div>
                  เมนู:{" "}
                  <span className="font-medium">{food.menuName || "-"}</span>
                </div>
                {food.addons?.length > 0 && (
                  <div>
                    Add-on:{" "}
                    <span className="font-medium">
                      {food.addons.join(", ")}
                    </span>
                  </div>
                )}
                {food.drink && (
                  <div>
                    เครื่องดื่ม:{" "}
                    <span className="font-medium">{food.drink}</span>
                  </div>
                )}
                {food.note && (
                  <div>
                    หมายเหตุ: <span className="font-medium">{food.note}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-1 text-[13px] text-front-textMuted">
                ยังไม่พบข้อมูลเมนูอาหารที่เลือกสำหรับวันนี้
              </div>
            )}
          </div>
        </div>

        {/* พื้นที่เซ็นลายเซ็น */}
        <div className="mt-4">
          <SignaturePad onChange={handleSignatureChange} />
        </div>

        {/* ปุ่ม Back & ยืนยัน */}
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() =>
              router.push(
                `/classroom/checkin/food?studentId=${studentId}&classId=${classId}&day=${day}`,
              )
            }
            className="flex-1 rounded-2xl border border-brand-border bg-white px-4 py-2 text-sm font-medium text-front-text hover:bg-front-bgSoft"
          >
            ← ย้อนกลับไปเลือกเมนูอาหาร (Step 2)
          </button>

          <PrimaryButton
            className="flex-1"
            onClick={handleSubmit}
            disabled={submitting || !signature}
          >
            ยืนยัน
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
