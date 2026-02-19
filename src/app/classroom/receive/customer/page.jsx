// src/app/classroom/receive/customer/page.jsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}
function clean(x) {
  return String(x || "").trim();
}
function formatDateTH(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}
function toLabelReceiveType(x) {
  const v = clean(x);
  if (v === "on_class") return "มารับ ณ วันอบรม";
  if (v === "ems") return "ส่งทางไปรษณีย์";
  return v || "-";
}

export default function ReceiveCustomerSearchPage() {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [todayYMD, setTodayYMD] = useState("");
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  const hintText = useMemo(() => {
    return todayYMD
      ? `ระบบจะแสดงเฉพาะผู้ที่เช็คอินแล้วใน “วันนี้” (${todayYMD})`
      : "พิมพ์ชื่อ/บริษัท/เลขที่ QT/IV/RP เพื่อค้นหา";
  }, [todayYMD]);

  const hasSearched = useMemo(() => {
    return !!todayYMD || loading || !!err || items.length > 0;
  }, [todayYMD, loading, err, items.length]);

  async function doSearch() {
    const qq = clean(q);
    setErr("");
    setItems([]);

    if (!qq) {
      setErr("กรุณาพิมพ์คำค้นหา (ชื่อ/บริษัท/เลขที่ INV...)");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/classroom/receive/customer/search?q=${encodeURIComponent(qq)}`,
        { cache: "no-store" },
      );
      const data = await res.json().catch(() => ({}));

      setTodayYMD(data?.today || "");

      if (!res.ok || data?.ok === false) {
        setErr(data?.error || "ค้นหาไม่สำเร็จ");
        setItems([]);
        return;
      }

      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setErr("เกิดข้อผิดพลาดในการค้นหา");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function goSign(it) {
    const classId = it.classId;
    const docId = it.docIdNormalized || it.docId || "";
    const receiverIndex = String(Number(it.receiverIndex || 0));
    if (!classId || !docId) {
      setErr("ข้อมูลรายการไม่ครบ (classId/docId)");
      return;
    }
    router.push(
      `/classroom/receive/customer/sign?classId=${encodeURIComponent(
        classId,
      )}&docId=${encodeURIComponent(docId)}&receiverIndex=${encodeURIComponent(
        receiverIndex,
      )}`,
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6 h-[100dvh] flex flex-col overflow-hidden">
      <div className="mb-4 flex items-start gap-3">
        <Link
          href="/classroom"
          className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-admin-border bg-white text-admin-text hover:bg-admin-surfaceMuted"
          aria-label="ย้อนกลับ"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>

        <div className="flex-1">
          <div className="text-sm uppercase tracking-wide text-admin-textMuted">
            Receive
          </div>
          <h1 className="mt-1 sm:text-2xl lg:text-lg font-semibold text-admin-text">
            รับเอกสาร (ลูกค้ารับเอกสาร)
          </h1>
          <div className="mt-1 sm:text-lg lg:text-sm text-admin-textMuted">{hintText}</div>
        </div>
      </div>

      {/* Search box */}
      <div className="rounded-2xl border border-admin-border bg-white p-4">
        <div className="sm:text-xl lg:text-sm font-semibold text-admin-text">
          Step 1: ค้นหา
        </div>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="พิมพ์เลขที่ QT/IV/RP เช่น INV-001, RP2026..."
            className="w-full rounded-xl border border-admin-border bg-white px-3 py-2 sm:text-lg lg:text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
            onKeyDown={(e) => {
              if (e.key === "Enter") doSearch();
            }}
          />
          <button
            type="button"
            onClick={doSearch}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-primary px-4 sm:text-lg lg:text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "กำลังค้นหา..." : "ค้นหา"}
          </button>
        </div>

        {hasSearched && (
          <div className="mt-3 sm:text-base lg:text-sm text-admin-textMuted">
            พบ {items.length} รายการ
            {todayYMD ? <span> (Today: {todayYMD})</span> : null}
          </div>
        )}

        {err && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="mt-4 flex-1 min-h-0">
        {items.length > 0 ? (
          <div className="h-full min-h-0 overflow-y-auto pr-1 space-y-3">
            {items.map((it, idx) => {
              const signed = !!it.signedUrl;
              return (
                <button
                  key={`${it.studentId}-${it.classId}-${idx}`}
                  type="button"
                  onClick={() => goSign(it)}
                  className={cx(
                    "w-full text-left rounded-2xl border p-4 transition",
                    "border-[#48B0FF] bg-white hover:bg-admin-surfaceMuted/40",
                    signed ? "opacity-90" : "",
                  )}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="sm:text-xl lg:text-base font-semibold text-admin-text">
                        {it.name}
                      </div>
                      <div className="sm:text-lg lg:text-sm text-admin-textMuted">
                        {it.company || "-"}
                      </div>
                    </div>

                    <div className="sm:text-base lg:text-sm text-admin-textMuted">
                      <span className="font-medium text-admin-text">
                        QT/IV/RP:
                      </span>{" "}
                      {it.docIdNormalized || it.docId || "-"}
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl bg-[#48B0FF]/20 p-3 sm:text-lg lg:text-sm text-admin-text">
                    <div className="font-medium">
                      Class: {it.classInfo?.title || "-"}
                    </div>
                    <div className="mt-1 text-admin-textMuted">
                      วันอบรม: {it.classInfo?.dateText || "-"} • ห้อง:{" "}
                      {it.classInfo?.roomName || "-"}
                    </div>
                    <div className="mt-1 text-admin-textMuted">
                      วันนี้คือ Day {it.dayIndex || "-"} • ช่องทางรับเอกสาร:{" "}
                      {toLabelReceiveType(it.documentReceiveType)}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {it.documentReceivedAt ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          รับเอกสารแล้ว ({formatDateTH(it.documentReceivedAt)})
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-100 px-3 py-1 sm:text-base lg:text-xs font-semibold text-zinc-700">
                          ยังไม่รับเอกสาร
                        </span>
                      )}

                      {signed ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 sm:text-base lg:text-xs font-semibold text-emerald-700">
                          มีลายเซ็นแล้ว
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-100 px-3 py-1 sm:text-base lg:text-xs font-semibold text-zinc-700">
                          รอเซ็น
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          hasSearched &&
          !loading && (
            <div className="rounded-2xl border border-admin-border bg-white p-4 text-sm text-admin-textMuted">
              ไม่พบข้อมูลของวันนี้ (หรือยังไม่มีผู้เช็คอินในวันนี้ / หรือไม่พบเลขเอกสารในระบบ)
            </div>
          )
        )}
      </div>

      <div className="mt-4 text-xs text-admin-textMuted">
        Notes: หน้านี้จะแสดงเฉพาะ “รอบอบรมวันนี้” และ “ผู้ที่เช็คอินแล้วในวันนี้”
      </div>
    </div>
  );
}
