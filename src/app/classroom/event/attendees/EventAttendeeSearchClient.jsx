"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";

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

export default function EventAttendeeSearchClient({ searchParams }) {
  const router = useRouter();

  const eventId = useMemo(() => pick(searchParams, "eventId"), [searchParams]);
  //   const success = useMemo(() => pick(searchParams, "success"), [searchParams]);

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [eventInfo, setEventInfo] = useState(null);
  const [canCheckin, setCanCheckin] = useState(true);
  const [results, setResults] = useState([]);
  const [err, setErr] = useState("");

  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!eventId) {
      router.replace("/classroom/event");
      return;
    }
    loadEventInfo();
  }, [eventId, router]);

  async function loadEventInfo() {
    if (!eventId) return;

    setErr("");
    setLoading(true);
    try {
      const url = new URL(
        "/api/classroom/event/search",
        window.location.origin,
      );
      url.searchParams.set("eventId", eventId);
      url.searchParams.set("q", "");

      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "load event failed");
      }

      setEventInfo(data.event || null);
      setCanCheckin(!!data.canCheckin);
      setResults([]);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function doSearch() {
    setErr("");
    setHasSearched(true);

    const query = q.trim();
    if (!query) {
      setErr("กรุณาพิมพ์ชื่อ / เบอร์โทร / อีเมล");
      return;
    }

    if (!eventId) {
      setErr("ไม่พบ eventId");
      return;
    }

    setLoading(true);
    try {
      const url = new URL(
        "/api/classroom/event/search",
        window.location.origin,
      );
      url.searchParams.set("q", query);
      url.searchParams.set("eventId", eventId);

      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "search failed");
      }

      setEventInfo(data.event || null);
      setCanCheckin(!!data.canCheckin);
      setResults(data.items || []);
    } catch (e) {
      setErr(String(e?.message || e));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function choose(item) {
    if (!canCheckin) {
      setErr("Event นี้ไม่อยู่ในช่วงเวลาเช็คอิน");
      return;
    }

    if (item?.checkedInAt) {
      setErr("รายการนี้เช็คอินแล้ว");
      return;
    }

    router.push(
      `/classroom/event/sign?eventId=${encodeURIComponent(eventId)}&attendeeId=${encodeURIComponent(item._id)}`,
    );
  }

  function backToEventList() {
    router.push("/classroom/event");
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-4">
      <div className="mb-4 rounded-2xl">
        {/* <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">ค้นหาผู้เข้าร่วมงาน</div>
            <div className="text-sm text-zinc-600">
              ค้นหาชื่อ เบอร์โทร หรืออีเมล ภายใน Event ที่เลือก
            </div>
          </div>

          <button
            onClick={backToEventList}
            className="h-10 shrink-0 rounded-xl border px-4 text-sm font-semibold hover:bg-zinc-50"
            disabled={loading}
          >
            กลับไปเลือก Event
          </button>
        </div> */}

        {!!eventInfo && (
          <div className="overflow-hidden rounded-2xl border bg-white">
            <div className="flex flex-col md:flex-row">
              <div className="flex min-w-0 flex-1 flex-row gap-4 p-4">
                <button
                  onClick={backToEventList}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-admin-border bg-white text-admin-text hover:bg-admin-surfaceMuted"
                  disabled={loading}
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>

                <div>
                  <div className="text-2xl font-semibold">
                    {eventInfo.title}
                  </div>
                  <div className="mt-2 text-base text-zinc-700">
                    สถานที่: {eventInfo.location || "-"}
                  </div>
                  <div className="text-base text-zinc-700">
                    เวลา: {formatDTTH(eventInfo.startAt || eventInfo.startDate)}
                  </div>
                </div>
              </div>

              <div className="relative h-48 w-full shrink-0 bg-zinc-100 md:w-96">
                {eventInfo.coverImageUrl ? (
                  <Image
                    src={eventInfo.coverImageUrl}
                    alt={eventInfo.title || "Event cover"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 288px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
                    No Image
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* {!!eventInfo && (
          <div className="mt-4 overflow-hidden rounded-2xl border bg-white flex flex-row">
            <div className="p-4 text-sm">
              <div className="font-semibold text-2xl">{eventInfo.title}</div>
              <div className="mt-1 text-zinc-700 text-lg">
                สถานที่: {eventInfo.location || "-"}
              </div>
              <div className="text-zinc-700 text-lg">
                เวลา: {formatDTTH(eventInfo.startAt || eventInfo.startDate)}
              </div>
            </div>

            <div className="relative h-48 w-56 shrink-0 bg-zinc-100 sm:w-72">
              {eventInfo.coverImageUrl ? (
                <Image
                  src={eventInfo.coverImageUrl}
                  alt={eventInfo.title || "Event cover"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 768px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
                  No Image
                </div>
              )}
            </div>
          </div>
        )} */}

        {/* {success === "1" && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            บันทึกการเข้าร่วมเรียบร้อยแล้ว
          </div>
        )} */}

        {!canCheckin && !!eventInfo && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Event นี้อยู่นอกช่วงเวลาเช็คอินแล้ว
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 flex flex-col">
        <div className="sm:text-2xl lg:text-lg font-semibold text-[#0a1f33]">
          ค้นหารายชื่อ
        </div>

        <div className="mt-2 flex gap-3">
          <input
            className="w-full rounded-xl border border-brand-border bg-white sm:p-3 lg:p-2 sm:text-2xl lg:text-base text-front-text focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition "
            placeholder="พิมพ์ชื่อ / เบอร์โทร / อีเมล"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") doSearch();
            }}
          />
          <button
            className={cx(
              " rounded-xl px-8 py-2 text-lg font-bold",
              loading
                ? "bg-zinc-200 text-zinc-500"
                : "bg-[#66ccff] text-[#0d1b2a]",
            )}
            disabled={loading}
            onClick={doSearch}
          >
            ค้นหา
          </button>
        </div>

        {err && <div className="mt-3 text-sm text-red-600">{err}</div>}

        <div className="mt-4 min-h-0 flex-1">
          <div className="h-full overflow-y-auto pr-1">
            {loading ? (
              <div className="text-base text-zinc-500">กำลังค้นหา...</div>
            ) : !hasSearched ? null : !results?.length ? (
              <div className="text-base text-zinc-500">ไม่พบรายการ</div>
            ) : (
              <div className="space-y-4 p-1">
                {results.map((it) => (
                  <button
                    key={it._id}
                    className={cx(
                      "w-full text-left rounded-2xl p-4 shadow-sm transition bg-white ring-1 ring-[#48B0FF] hover:bg-front-bgSoft/80",
                      it.checkedInAt || !canCheckin
                        ? "cursor-not-allowed bg-zinc-50 opacity-80"
                        : "hover:bg-zinc-50",
                    )}
                    onClick={() => choose(it)}
                  >
                    <div className="sm:text-3xl lg:text-base font-semibold text-[#0D1B2A]">
                      {it.fullName}
                    </div>
                    <div className="mt-1 sm:text-xl lg:text-sm text-front-textMuted">
                      {it.phone ? `โทร: ${it.phone}` : ""}
                      {it.phone && it.email ? " • " : ""}
                      {it.email ? `อีเมล: ${it.email}` : ""}
                    </div>
                    <div className="mt-2 sm:text-xl lg:text-sm text-zinc-500">
                      สถานะ:{" "}
                      {it.checkedInAt ? (
                        <span className="font-semibold text-emerald-700">
                          เช็คอินแล้ว
                        </span>
                      ) : !canCheckin ? (
                        <span className="font-semibold text-amber-700">
                          อยู่นอกช่วงเวลาเช็คอิน
                        </span>
                      ) : (
                        <span className="font-semibold text-zinc-700">
                          ยังไม่เช็คอิน
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
