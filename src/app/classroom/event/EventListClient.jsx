"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function formatDTTH(x) {
  if (!x) return "-";
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

export default function EventListClient() {
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    loadActiveEvents();
  }, []);

  async function loadActiveEvents() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/classroom/event/list", {
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

  function goEvent(ev) {
    router.push(
      `/classroom/event/attendees?eventId=${encodeURIComponent(ev._id)}`,
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-6">
      <div className="shrink-0">
        <div className="text-xl font-semibold">เลือก Event ที่ต้องการเช็คอิน</div>
        <div className="mb-4 text-sm font-medium text-zinc-700">
          รายการ Event ที่เปิดใช้งานอยู่
        </div>

        {err && <div className="mb-4 text-sm text-red-600">{err}</div>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="text-sm text-zinc-500">กำลังโหลดรายการ Event...</div>
        ) : !items.length ? (
          <div className="text-sm text-zinc-500">ไม่พบ Event ที่เปิดใช้งาน</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {items.map((ev) => (
              <button
                key={ev._id}
                onClick={() => goEvent(ev)}
                className={cx(
                  "overflow-hidden rounded-2xl border bg-white text-left transition",
                  "hover:bg-zinc-50",
                )}
              >
                <div className="relative aspect-[16/9] w-full bg-zinc-100">
                  {ev.coverImageUrl ? (
                    <Image
                      src={ev.coverImageUrl}
                      alt={ev.title}
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
                  <div className="text-base font-semibold">{ev.title}</div>
                  <div className="mt-1 text-sm text-zinc-600">
                    สถานที่: {ev.location || "-"}
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">
                    เวลา: {formatDTTH(ev.startAt || ev.startDate)}
                  </div>

                  <div className="mt-3">
                    <span className="inline-flex items-center rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                      เลือก Event นี้
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