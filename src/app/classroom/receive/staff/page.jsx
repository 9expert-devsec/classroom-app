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

function formatTodayHint(todayYMD) {
  return "ค้นหาได้จากชื่อ / บริษัท / เลขที่ INV — จะแสดงเฉพาะผู้ที่เคยเช็คอินแล้ว";
}

export default function ReceiveStaffSearchPage() {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [todayYMD, setTodayYMD] = useState("");
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  const hintText = useMemo(() => formatTodayHint(todayYMD), [todayYMD]);

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
        `/api/classroom/receive/staff/search?q=${encodeURIComponent(qq)}`,
        { cache: "no-store" },
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false) {
        setTodayYMD(data?.today || "");
        setErr(data?.error || "ค้นหาไม่สำเร็จ");
        setItems([]);
        return;
      }

      setTodayYMD(data?.today || "");
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setItems([]);
      setErr("เกิดข้อผิดพลาดในการค้นหา");
    } finally {
      setLoading(false);
    }
  }

  function goDetail(it) {
    const classId = clean(it?.classId);
    const docId = clean(it?.docIdNormalized || it?.docId);
    const studentId = clean(it?.studentId);

    router.push(
      `/classroom/receive/staff/detail?classId=${encodeURIComponent(
        classId,
      )}&docId=${encodeURIComponent(docId)}&studentId=${encodeURIComponent(
        studentId,
      )}`,
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-4 flex items-start gap-3">
        <Link
          href="/classroom/receive"
          className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-admin-border bg-white text-admin-text hover:bg-admin-surfaceMuted"
          aria-label="ย้อนกลับ"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>

        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-wide text-admin-textMuted">
            Sent Doc : Search
          </div>
          <h1 className="mt-1 text-lg font-semibold text-admin-text">
            นำส่งเอกสาร (เจ้าหน้าที่รับเอกสารจากลูกค้า)
          </h1>
          <div className="mt-1 text-sm text-admin-textMuted">{hintText}</div>
        </div>
      </div>

      {/* Search box */}
      <div className="rounded-2xl border border-admin-border bg-white p-4">
        <div className="text-sm font-semibold text-admin-text">
          Search: ค้นหาผู้ส่งเอกสาร
        </div>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="พิมพ์ชื่อ / บริษัท / เลขที่ INV เช่น INV-001, INV 001"
            className="w-full rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
            onKeyDown={(e) => {
              if (e.key === "Enter") doSearch();
            }}
          />
          <button
            type="button"
            onClick={doSearch}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "กำลังค้นหา..." : "ค้นหา"}
          </button>
        </div>

        {hasSearched && (
          <div className="mt-3 text-sm text-admin-textMuted">
            พบ {items.length} รายการ{" "}
            {todayYMD ? <span>(Today: {todayYMD})</span> : null}
          </div>
        )}

        {err && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="mt-4">
        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((it, idx) => (
              <button
                key={`${it.studentId}-${it.classId}-${idx}`}
                type="button"
                onClick={() => goDetail(it)}
                className={cx(
                  "w-full text-left rounded-2xl border p-4 transition",
                  "border-admin-border bg-white hover:bg-admin-surfaceMuted/40",
                )}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-base font-semibold text-admin-text">
                      {it.name}
                    </div>
                    <div className="text-sm text-admin-textMuted">
                      {it.company || "-"}
                    </div>
                  </div>

                  <div className="text-sm text-admin-textMuted">
                    <span className="font-medium text-admin-text">
                      QT/IV/RP:
                    </span>{" "}
                    {it.docIdNormalized || it.docId || "-"}
                  </div>
                </div>

                <div className="mt-3 rounded-2xl bg-admin-surface p-3 text-sm text-admin-text">
                  <div className="font-medium">
                    Class: {it.classInfo?.title || "-"}
                  </div>
                  <div className="mt-1 text-admin-textMuted">
                    วันอบรม: {it.classInfo?.dateText || "-"} • ห้อง:{" "}
                    {it.classInfo?.roomName || "-"}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {it.staffSignedAt ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        เคยบันทึกแล้ว
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                        ยังไม่บันทึกโหมด 3.2
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          hasSearched &&
          !loading && (
            <div className="rounded-2xl border border-admin-border bg-white p-4 text-sm text-admin-textMuted">
              ไม่พบข้อมูลของวันนี้ (หรือยังไม่มีผู้เช็คอินในวันนี้ /
              หรือคำค้นหาไม่ตรง)
            </div>
          )
        )}
      </div>
    </div>
  );
}
