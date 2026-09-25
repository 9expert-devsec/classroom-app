// src/app/classroom/masterclass/checkin/MasterclassCheckinClient.jsx
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import MasterclassStepHeader from "../MasterclassStepHeader";
import TextInput from "@/components/ui/TextInput";
import UserButton from "@/components/ui/UserButton";
import SearchResultCard from "../../checkin/SearchResultCard";
import { kioskFetch } from "@/lib/kioskFetch";

function pick(sp, key) {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

function resolveTodayDay(classInfo) {
  if (!classInfo?.date) return 1;

  const start = new Date(classInfo.date);
  const today = new Date();

  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diff = Math.floor((today - start) / (24 * 60 * 60 * 1000)) + 1;
  const maxDay = classInfo.dayCount || 1;

  if (diff < 1 || diff > maxDay) {
    // วันนี้ไม่อยู่ในช่วงอบรม → default ให้เป็น Day 1
    return 1;
  }
  return diff;
}

/**
 * แบนเนอร์เต็มความกว้าง — แสดงเฉพาะ Step 1
 * ใช้ classImageUrl ของคลาส ถ้าไม่มีค่อย fallback เป็น cover ของคอร์ส
 * ถ้าไม่มีทั้งคู่ = ไม่ render อะไรเลย
 */
function MasterclassBanner({ classCtx }) {
  const src = classCtx?.classImageUrl || classCtx?.coverImageUrl || "";
  if (!src) return null;

  return (
    <div className="mx-4 mt-3 mb-1 flex shrink-0 overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm">
      <div className="h-[200px] w-full shrink-0 overflow-hidden">
        <img
          src={src}
          alt={classCtx?.courseName || "masterclass banner"}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}

export default function MasterclassCheckinClient({ searchParams = {} }) {
  const router = useRouter();

  const classIdQS = useMemo(() => {
    return pick(searchParams, "classId") || pick(searchParams, "classid") || "";
  }, [searchParams]);

  const dayQS = useMemo(() => {
    const n = Number(pick(searchParams, "day"));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [searchParams]);

  const [classCtx, setClassCtx] = useState(null);

  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const timeoutRef = useRef(null);

  // ✅ classId บังคับ — เข้ามาตรง ๆ โดยไม่เลือกคลาสให้กลับไปหน้ารายการ
  useEffect(() => {
    if (!classIdQS) router.replace("/classroom/masterclass");
  }, [classIdQS, router]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // โหลดข้อมูลคลาส (แบนเนอร์ + วันอบรมของวันนี้)
  useEffect(() => {
    if (!classIdQS) return;
    let alive = true;

    async function loadClass() {
      try {
        const qs = new URLSearchParams({ classId: classIdQS }).toString();
        const res = await kioskFetch(`/api/classroom/masterclass/class?${qs}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;

        if (!res.ok || !data?.ok) {
          // ไม่ใช่คลาส Masterclass (หรือหาไม่เจอ) → กลับไปหน้ารายการ
          router.replace("/classroom/masterclass");
          return;
        }

        setClassCtx(data.item || null);
      } catch (e) {
        console.error("load masterclass class fail", e);
      }
    }

    loadClass();
    return () => {
      alive = false;
    };
  }, [classIdQS, router]);

  // day ที่ใช้จริง: URL ก่อน แล้วค่อย dayIndexToday จาก API
  const effectiveDay = useMemo(() => {
    if (dayQS > 0) return dayQS;
    const fromApi = Number(classCtx?.dayIndexToday);
    return Number.isFinite(fromApi) && fromApi > 0 ? fromApi : 1;
  }, [dayQS, classCtx]);

  async function doSearch(currentKeyword) {
    const k = currentKeyword.trim();
    if (k.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await kioskFetch("/api/checkin/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: k,
          classId: classIdQS || null,
          day: effectiveDay,
        }),
      });

      const data = await res.json();
      setResults(data.items || []);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการค้นหา");
    }
    setLoading(false);
  }

  function handleKeywordChange(e) {
    const value = e.target.value;
    setKeyword(value);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    timeoutRef.current = setTimeout(() => {
      doSearch(trimmed);
    }, 300);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await doSearch(keyword);
  }

  // ✅ Masterclass ไม่มีขั้นตอนอาหาร → ไป Step 2 (เซ็นลายเซ็น) ตรง ๆ
  function handleSelectStudent(student) {
    const studentId = student._id;

    const clsIdFromStudent =
      student.classId ||
      student.class_id ||
      student.classInfo?._id ||
      classIdQS ||
      "";

    const day =
      dayQS > 0
        ? dayQS
        : Number(classCtx?.dayIndexToday) > 0
          ? Number(classCtx.dayIndexToday)
          : resolveTodayDay(student.classInfo);

    const qs = new URLSearchParams();
    if (clsIdFromStudent) qs.set("classId", clsIdFromStudent);
    qs.set("studentId", studentId);
    qs.set("day", String(day));

    router.push(`/classroom/masterclass/sign?${qs.toString()}`);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <MasterclassStepHeader currentStep={1} />

      {/* ✅ แบนเนอร์: Step 1 เท่านั้น */}
      <MasterclassBanner classCtx={classCtx} />

      <div className="flex min-h-0 flex-1 flex-col px-6 py-6">
        <h2 className="sm:text-2xl lg:text-lg font-semibold">
          Step 1 : ค้นหาชื่อ
        </h2>

        {classCtx && (
          <p className="mt-1 sm:text-base lg:text-sm text-front-textMuted">
            {classCtx.courseName}
            {classCtx.room ? ` • ${classCtx.room}` : ""}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-4 flex flex-col items-center shrink-0"
        >
          <TextInput
            placeholder="ค้นหาชื่อ.........."
            value={keyword}
            onChange={handleKeywordChange}
          />

          <UserButton type="submit" disabled={loading}>
            {loading ? "กำลังค้นหา..." : "ค้นหา"}
          </UserButton>
        </form>

        <div className="mt-6 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-2 flex flex-col gap-2">
          {keyword && !loading && results.length === 0 && (
            <p className="text-front-textMuted">
              ไม่พบชื่อในรอบอบรมของวันนี้ (ตรวจสอบการสะกดชื่ออีกครั้ง)
            </p>
          )}

          {results.map((item) => (
            <SearchResultCard
              key={item._id}
              student={item}
              onClick={() => handleSelectStudent(item)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
