"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

function pick(sp, key) {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function formatDTTH(x) {
  if (!x) return "-";
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

export default function EventSelectClient({ searchParams }) {
  const router = useRouter();
  const presetQ = useMemo(() => pick(searchParams, "q"), [searchParams]);

  const [q, setQ] = useState(presetQ || "");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function loadMine() {
    setErr("");
    const query = q.trim();
    if (!query) {
      setErr("กรุณาพิมพ์ชื่อ/เบอร์โทร/อีเมล เพื่อค้นหา Event ของคุณ");
      return;
    }
    setLoading(true);
    try {
      const url = new URL("/api/classroom/event/list", window.location.origin);
      url.searchParams.set("q", query);
      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "load failed");
      setItems(data.items || []);
      if (!data.items?.length) setErr("ไม่พบ Event ที่คุณมีรายชื่ออยู่");
    } catch (e) {
      setErr(String(e?.message || e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function goCheckin(ev) {
    router.push(
      `/classroom/event/checkin?eventId=${encodeURIComponent(ev._id)}`,
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-xl font-semibold">เลือก Event</div>
        <div className="mt-1 text-sm text-zinc-600">
          พิมพ์ชื่อ/เบอร์/อีเมล เพื่อแสดง Event ที่คุณมีรายชื่อ
          แล้วกดเพื่อไปเช็คอิน
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-sm font-medium text-zinc-700">
          ค้นหา Event ของคุณ
        </div>
        <div className="mt-2 flex gap-2">
          <input
            className="h-11 w-full rounded-xl border px-3 outline-none focus:ring-2"
            placeholder="พิมพ์ชื่อ / เบอร์โทร / อีเมล"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadMine();
            }}
          />
          <button
            className={cx(
              "h-11 rounded-xl px-4 font-semibold",
              loading ? "bg-zinc-200 text-zinc-500" : "bg-black text-white",
            )}
            disabled={loading}
            onClick={loadMine}
          >
            ค้นหา
          </button>
        </div>

        {err && <div className="mt-3 text-sm text-red-600">{err}</div>}

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((ev) => (
            <button
              key={ev._id}
              onClick={() => goCheckin(ev)}
              className="overflow-hidden rounded-2xl border text-left hover:bg-zinc-50"
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
                  เวลา: {formatDTTH(ev.startAt)}
                </div>

                <div className="mt-3">
                  <span className="inline-flex items-center rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                    ไปเช็คอิน
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {!items.length && !err && (
          <div className="mt-4 text-sm text-zinc-500">
            ยังไม่มีรายการ (กรุณาค้นหาก่อน)
          </div>
        )}
      </div>
    </div>
  );
}
