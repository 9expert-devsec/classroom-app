// src/app/classroom/checkin/CheckinClient.jsx
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import StepHeader from "./StepHeader";
import TextInput from "@/components/ui/TextInput";
import UserButton from "@/components/ui/UserButton";
import SearchResultCard from "./SearchResultCard";

function pick(sp, key) {
  const v = sp?.[key];
  return Array.isArray(v) ? (v[0] || "") : (v || "");
}

// P3g: "วันนี้คือ Day ไหน" ตัดสินที่ server (/api/checkin/search -> classInfo.todayDay)
// เดิมคำนวณจากนาฬิกาเครื่องกับ date + dayCount ซึ่งไม่ดู days[] และถ้าคลาสไม่มี
// dayCount จะตกไป Day 1 เงียบ ๆ (บันทึกอาหาร/คูปองผิดวัน)
// วันนี้ไม่ใช่วันเรียน (null) -> Day 1 แบบเดิม ให้ server ปฏิเสธคูปองเอง
function resolveTodayDay(classInfo) {
  const d = Number(classInfo?.todayDay);
  return Number.isInteger(d) && d > 0 ? d : 1;
}

export default function CheckinClient({ searchParams = {} }) {
  const router = useRouter();

  const classIdQS = useMemo(() => {
    return (
      pick(searchParams, "classId") ||
      pick(searchParams, "classid") ||
      ""
    );
  }, [searchParams]);

  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function doSearch(currentKeyword) {
    const k = currentKeyword.trim();
    if (k.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/checkin/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: k,
          classId: classIdQS || null,
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

  // ✅ เมื่อ user คลิกการ์ด → คำนวณ day แล้วส่งไป Step 2
  function handleSelectStudent(student) {
    const studentId = student._id;

    const clsIdFromStudent =
      student.classId ||
      student.class_id ||
      student.classInfo?._id ||
      classIdQS ||
      "";

    const day = resolveTodayDay(student.classInfo);

    const qs = new URLSearchParams();
    if (clsIdFromStudent) qs.set("classId", clsIdFromStudent);
    qs.set("studentId", studentId);
    qs.set("day", String(day));

    router.push(`/classroom/checkin/food?${qs.toString()}`);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <StepHeader currentStep={1} />

      <div className="flex min-h-0 flex-1 flex-col px-6 py-6">
        <h2 className="sm:text-2xl lg:text-lg font-semibold">Step 1 : ค้นหาชื่อ</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 flex flex-col items-center shrink-0">
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
