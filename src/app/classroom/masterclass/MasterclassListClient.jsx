// src/app/classroom/masterclass/MasterclassListClient.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

const thMonths = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

function parseYMD(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function fmtShort(p) {
  return `${p.d} ${thMonths[p.m - 1]} ${p.y + 543}`;
}

/** ["2026-01-26","2026-01-27"] → "26 - 27 ม.ค. 2569" */
function formatThaiDateRange(days) {
  const list = (Array.isArray(days) ? days : []).map(parseYMD).filter(Boolean);
  if (!list.length) return "";

  const sorted = [...list].sort(
    (a, b) => a.y - b.y || a.m - b.m || a.d - b.d,
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (sorted.length === 1) return fmtShort(first);

  if (first.y === last.y && first.m === last.m) {
    return `${first.d} - ${last.d} ${thMonths[first.m - 1]} ${first.y + 543}`;
  }

  if (first.y === last.y) {
    return `${first.d} ${thMonths[first.m - 1]} - ${last.d} ${
      thMonths[last.m - 1]
    } ${first.y + 543}`;
  }

  return `${fmtShort(first)} - ${fmtShort(last)}`;
}

function formatTimeRange(startTime, endTime) {
  const s = String(startTime || "").trim();
  const e = String(endTime || "").trim();
  if (s && e) return `${s} - ${e}`;
  return s || e || "-";
}

export default function MasterclassListClient() {
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    loadTodayClasses();
  }, []);

  async function loadTodayClasses() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/classroom/masterclass/list", {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "load failed");
      }

      setItems(data.items || []);
    } catch (e) {
      setErr(String(e?.message || e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function goClass(cls) {
    const qs = new URLSearchParams();
    qs.set("classId", String(cls._id));
    qs.set("day", String(cls.dayIndexToday || 1));
    router.push(`/classroom/masterclass/checkin?${qs.toString()}`);
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-6">
      <div className="shrink-0">
        <div className="text-xl font-semibold">
          เลือกคอร์ส Masterclass ที่ต้องการเช็คอิน
        </div>
        <div className="mb-4 text-sm font-medium text-zinc-700">
          รายการคลาสที่เปิดเช็คอินวันนี้
        </div>

        {err && <div className="mb-4 text-sm text-red-600">{err}</div>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="text-sm text-zinc-500">
            กำลังโหลดรายการ Masterclass...
          </div>
        ) : !items.length ? (
          <div className="text-sm text-zinc-500">
            ไม่พบคลาส Masterclass ที่เปิดเช็คอินวันนี้
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {items.map((cls) => (
              <button
                key={cls._id}
                onClick={() => goClass(cls)}
                className={cx(
                  "overflow-hidden rounded-2xl border bg-white text-left transition",
                  "hover:bg-zinc-50",
                )}
              >
                <div className="relative aspect-[16/9] w-full bg-zinc-100">
                  {cls.coverImageUrl ? (
                    <Image
                      src={cls.coverImageUrl}
                      alt={cls.courseName}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
                      No Image
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="text-base font-semibold">
                    {cls.courseName || cls.title}
                  </div>

                  {/* ✅ สถานที่ + วัน/เวลา ต้องแสดงเสมอ:
                      คอร์สเดียวกันที่จัด 2 รอบในวันเดียวกัน
                      แยกจากกันได้ด้วยสองบรรทัดนี้ */}
                  <div className="mt-1 text-sm text-zinc-600">
                    สถานที่: {cls.room || "-"}
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">
                    วันอบรม: {formatThaiDateRange(cls.days) || "-"}
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">
                    เวลา: {formatTimeRange(cls.startTime, cls.endTime)}
                  </div>

                  <div className="mt-3">
                    <span className="inline-flex items-center rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                      เลือกคอร์สนี้
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
