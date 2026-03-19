"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "@/components/shared/SignaturePad";
import UserButton from "@/components/ui/UserButton";
import { ChevronLeft } from "lucide-react";

function pick(sp, key) {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

function formatDTTH(x) {
  if (!x) return "-";
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

export default function EventSignClient({ searchParams }) {
  const router = useRouter();

  const eventId = useMemo(() => pick(searchParams, "eventId"), [searchParams]);
  const attendeeId = useMemo(
    () => pick(searchParams, "attendeeId"),
    [searchParams],
  );

  const [loading, setLoading] = useState(false);
  const [eventInfo, setEventInfo] = useState(null);
  const [selected, setSelected] = useState(null);
  const [canCheckin, setCanCheckin] = useState(true);
  const [sigDataUrl, setSigDataUrl] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!eventId || !attendeeId) {
      router.replace("/classroom/event");
      return;
    }
    loadDetail();
  }, [eventId, attendeeId, router]);

  async function loadDetail() {
    setErr("");
    setLoading(true);
    try {
      const url = new URL(
        "/api/classroom/event/attendee-detail",
        window.location.origin,
      );
      url.searchParams.set("eventId", eventId);
      url.searchParams.set("attendeeId", attendeeId);

      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "load detail failed");
      }

      setEventInfo(data.event || null);
      setSelected(data.item || null);
      setCanCheckin(!!data.canCheckin);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    setErr("");

    if (!canCheckin) {
      setErr("Event นี้ไม่อยู่ในช่วงเวลาเช็คอิน");
      return;
    }

    if (!eventId) {
      setErr("ไม่พบ eventId");
      return;
    }

    if (!selected?._id) {
      setErr("ไม่พบ attendeeId");
      return;
    }

    if (selected?.checkedInAt) {
      setErr("รายการนี้เช็คอินแล้ว");
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
          eventId,
          attendeeId: selected._id,
          signatureDataUrl: sigDataUrl,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "confirm failed");
      }

      router.replace(
        `/classroom/event/complete?eventId=${encodeURIComponent(eventId)}`,
      );
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  function backToSearch() {
    router.push(
      `/classroom/event/attendees?eventId=${encodeURIComponent(eventId)}`,
    );
  }

  return (
  <div className="flex h-full min-h-0 flex-col p-4">
    <div className="mb-2 shrink-0">
      <div className="flex min-w-0 flex-row gap-4">
        {/* <button
          onClick={backToSearch}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-admin-border bg-white text-admin-text hover:bg-admin-surfaceMuted"
          disabled={loading}
        >
          <ChevronLeft className="h-6 w-6" />
        </button> */}

        <div>
          <div className="text-2xl font-semibold">รายละเอียดผู้เข้าร่วมงาน</div>
          <div className="text-base text-zinc-600">
            ตรวจสอบข้อมูลและเซ็นเพื่อยืนยันการเข้าร่วมงาน
          </div>
        </div>
      </div>
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      {!!eventInfo && (
        <div className="mt-2 rounded-xl border border-[#66ccff] bg-white p-4 text-lg">
          <div className="text-xl font-semibold">
            Event : {eventInfo.title}
          </div>
          <div className="text-zinc-700">
            วันเวลา Event : {formatDTTH(eventInfo.startAt || eventInfo.startDate)} น.
          </div>
        </div>
      )}

      {!canCheckin && !!eventInfo && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Event นี้อยู่นอกช่วงเวลาเช็คอินแล้ว
        </div>
      )}

      <div className="mt-2">
        {loading && !selected ? (
          <div className="text-sm text-zinc-500">กำลังโหลดข้อมูล...</div>
        ) : selected ? (
          <>
            <div className="text-lg font-semibold">ข้อมูลผู้ร่วมงาน</div>

            <div className="mt-2 rounded-xl bg-zinc-50 p-4 text-lg">
              <div className="font-semibold">
                ชื่อ-นามสกุล : <span className="font-normal">{selected.fullName}</span>
              </div>
              {/* <div className="font-semibold">
                เบอร์โทร : <span className="font-normal">{selected.phone || "ไม่ระบุ"}</span>
              </div> */}
              <div className="font-semibold">
                อีเมล : <span className="font-normal">{selected.email || "ไม่ระบุ"}</span>
              </div>
              {/* <div className="font-semibold">
                ช่องที่ทราบข่าว : <span className="font-normal">{selected.sourceChannel || "ไม่ระบุ"}</span>
              </div>
              <div className="font-semibold">
                เพศ / อายุ :{" "}
                <span className="font-normal">
                  {(selected.gender || "ไม่ระบุ") + " / " + (selected.age ?? "-")}
                </span>
              </div>
              <div className="font-semibold">
                สถานภาพการทำงาน : <span className="font-normal">{selected.workStatus || "ไม่ระบุ"}</span>
              </div> */}
            </div>

            {selected.checkedInAt && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                รายการนี้เช็คอินแล้ว
              </div>
            )}

            <div className="mt-4 rounded-xl border p-4">
              <div className="text-lg font-semibold">ลายเซ็น</div>
              <div className="mt-3">
                <SignaturePad onChange={(dataUrl) => setSigDataUrl(dataUrl || "")} />
              </div>
            </div>

            {err && <div className="mt-3 text-lg text-red-600">{err}</div>}

            <div className="mt-4 flex gap-2 pb-4">
              <button
                className=" flex-1 rounded-xl border font-normal sm:text-2xl lg:text-base"
                onClick={backToSearch}
                disabled={loading}
              >
                ย้อนกลับ
              </button>

              <UserButton
                className="h-11 flex-1 rounded-xl"
                onClick={confirm}
                disabled={loading || !canCheckin || !!selected.checkedInAt}
              >
                {loading ? "กำลังบันทึก..." : "บันทึกการเข้าร่วม"}
              </UserButton>
            </div>
          </>
        ) : (
          <>
            {err ? (
              <div className="text-sm text-red-600">{err}</div>
            ) : (
              <div className="text-sm text-zinc-500">ไม่พบข้อมูลผู้เข้าร่วม</div>
            )}

            <div className="mt-4">
              <button
                className="h-11 rounded-xl border px-4 font-semibold"
                onClick={backToSearch}
              >
                กลับไปค้นหารายชื่อ
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  </div>
);
}
