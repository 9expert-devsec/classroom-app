"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "@/components/shared/SignaturePad";
import PrimaryButton from "@/components/ui/PrimaryButton";

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

export default function EventCheckinClient({ searchParams }) {
  const router = useRouter();

  const eventId = useMemo(() => pick(searchParams, "eventId"), [searchParams]);

  const [step, setStep] = useState(1); // 1 search, 2 confirm+sign, 3 success
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [eventInfo, setEventInfo] = useState(null);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);

  const [sigDataUrl, setSigDataUrl] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    // ถ้าไม่มี eventId ให้กลับไปหน้าเลือก Event
    if (!eventId) {
      router.replace("/classroom/event");
    }
  }, [eventId, router]);

  async function doSearch() {
    setErr("");
    const query = q.trim();
    if (!query) return;

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
      setResults(data.items || []);
    } catch (e) {
      setErr(String(e?.message || e));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function choose(item) {
    if (item?.checkedInAt) {
      setErr("รายการนี้เช็คอินแล้ว");
      return;
    }
    setSelected(item);
    setStep(2);
    setSigDataUrl("");
    setErr("");
  }

  async function confirm() {
    setErr("");
    if (!selected?._id) return;

    if (!eventId) {
      setErr("ไม่พบ eventId");
      return;
    }

    if (!sigDataUrl) {
      setErr("กรุณาเซ็นชื่อก่อนบันทึก");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/classroom/event/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId, // ✅ เพิ่มบรรทัดนี้
          attendeeId: selected._id,
          signatureDataUrl: sigDataUrl,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "confirm failed");
      }

      setStep(3);
      setTimeout(() => router.refresh(), 250);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  function backToEventSelect() {
    router.push("/classroom/event");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Event Check-in</div>
            <div className="mt-1 text-sm text-zinc-600">
              ค้นหาชื่อ เลือกรายชื่อ ตรวจสอบข้อมูล
              แล้วเซ็นเพื่อยืนยันการเข้าร่วม
            </div>
          </div>

          <button
            onClick={backToEventSelect}
            className="h-10 shrink-0 rounded-xl border px-4 text-sm font-semibold hover:bg-zinc-50"
            disabled={loading}
          >
            กลับไปเลือก Event
          </button>
        </div>

        {!!eventInfo && (
          <div className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm">
            <div className="font-semibold">{eventInfo.title}</div>
            <div className="mt-1 text-zinc-700">
              สถานที่: {eventInfo.location || "-"}
            </div>
            <div className="text-zinc-700">
              เวลา: {formatDTTH(eventInfo.startAt)}
            </div>
          </div>
        )}
      </div>

      {step === 1 && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm font-medium text-zinc-700">ค้นหาชื่อ</div>
          <div className="mt-2 flex gap-2">
            <input
              className="h-11 w-full rounded-xl border px-3 outline-none focus:ring-2"
              placeholder="พิมพ์ชื่อ / เบอร์โทร / อีเมล"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") doSearch();
              }}
            />
            <button
              className={cx(
                "h-11 rounded-xl px-4 font-semibold",
                loading ? "bg-zinc-200 text-zinc-500" : "bg-black text-white",
              )}
              disabled={loading}
              onClick={doSearch}
            >
              ค้นหา
            </button>
          </div>

          {err && <div className="mt-3 text-sm text-red-600">{err}</div>}

          <div className="mt-4">
            {!results?.length ? (
              <div className="text-sm text-zinc-500">
                {loading ? "กำลังค้นหา..." : "ยังไม่มีรายการ (กรุณาค้นหาก่อน)"}
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((it) => (
                  <button
                    key={it._id}
                    className="w-full rounded-xl border p-4 text-left hover:bg-zinc-50"
                    onClick={() => choose(it)}
                  >
                    <div className="font-semibold">{it.fullName}</div>
                    <div className="mt-1 text-sm text-zinc-600">
                      {it.phone ? `โทร: ${it.phone}` : ""}{" "}
                      {it.email ? `• อีเมล: ${it.email}` : ""}
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                      สถานะ:{" "}
                      {it.checkedInAt ? (
                        <span className="font-semibold text-emerald-700">
                          เช็คอินแล้ว
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
      )}

      {step === 2 && selected && (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold">ตรวจสอบข้อมูล</div>

            <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-zinc-50 p-4">
                <div className="text-xs text-zinc-500">ชื่อ-นามสกุล</div>
                <div className="font-semibold">{selected.fullName}</div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4">
                <div className="text-xs text-zinc-500">เบอร์โทร</div>
                <div className="font-semibold">{selected.phone || "-"}</div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4">
                <div className="text-xs text-zinc-500">อีเมล</div>
                <div className="font-semibold">{selected.email || "-"}</div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4">
                <div className="text-xs text-zinc-500">ช่องที่ทราบข่าว</div>
                <div className="font-semibold">
                  {selected.sourceChannel || "-"}
                </div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4">
                <div className="text-xs text-zinc-500">เพศ / อายุ</div>
                <div className="font-semibold">
                  {(selected.gender || "-") + " / " + (selected.age ?? "-")}
                </div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4">
                <div className="text-xs text-zinc-500">สถานภาพการทำงาน</div>
                <div className="font-semibold">
                  {selected.workStatus || "-"}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border p-4">
              <div className="text-sm font-semibold">ลายเซ็น</div>
              <div className="mt-3">
                <SignaturePad
                  onChange={(dataUrl) => setSigDataUrl(dataUrl || "")}
                />
              </div>
            </div>

            {err && <div className="mt-3 text-sm text-red-600">{err}</div>}

            <div className="mt-4 flex gap-2">
              <button
                className="h-11 flex-1 rounded-xl border font-semibold"
                onClick={() => {
                  setStep(1);
                  setSelected(null);
                  setSigDataUrl("");
                  setErr("");
                }}
                disabled={loading}
              >
                ย้อนกลับ
              </button>

              <PrimaryButton
                className="h-11 flex-1 rounded-xl"
                onClick={confirm}
                disabled={loading}
              >
                {loading ? "กำลังบันทึก..." : "บันทึกการเข้าร่วม"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <div className="text-2xl font-extrabold text-emerald-700">สำเร็จ</div>
          <div className="mt-2 text-sm text-zinc-600">
            บันทึกการเข้าร่วมเรียบร้อยแล้ว
          </div>

          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              className="h-11 w-full rounded-xl border font-semibold"
              onClick={backToEventSelect}
            >
              กลับไปเลือก Event
            </button>

            <button
              className="h-11 w-full rounded-xl bg-black font-semibold text-white"
              onClick={() => {
                // เช็คอินคนถัดไป (ใน event เดิม)
                setStep(1);
                setSelected(null);
                setResults([]);
                setQ("");
                setSigDataUrl("");
                setErr("");
              }}
            >
              เช็คอินคนถัดไป
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
