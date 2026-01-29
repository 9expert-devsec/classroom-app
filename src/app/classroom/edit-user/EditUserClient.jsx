// src/app/classroom/edit-user/page.jsx
"use client";

import Link from "next/link";
import { ChevronLeft, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function pick(sp, key) {
  const v = sp?.get?.(key);
  return v || "";
}

export default function EditUserPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const day = Number(pick(sp, "day") || 1);

  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  const returnTo = useMemo(() => {
    return `/classroom/edit-user?day=${day}`;
  }, [day]);

  async function doSearch() {
    const k = String(keyword || "").trim();
    setErr("");
    if (!k) {
      setItems([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/classroom/edit-user/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword: k, day }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error || "ค้นหาไม่สำเร็จ");
        setItems([]);
      } else {
        setItems(Array.isArray(data?.items) ? data.items : []);
      }
    } catch (e) {
      console.error(e);
      setErr("เรียก API ไม่สำเร็จ");
      setItems([]);
    }
    setLoading(false);
  }

  function openFoodEdit(row) {
    const sid = String(row?._id || "");
    const cid = String(row?.classId || row?.classInfo?._id || "");
    if (!sid || !cid) return;

    router.push(
      `/classroom/checkin/food?studentId=${encodeURIComponent(
        sid,
      )}&classId=${encodeURIComponent(cid)}&day=${day}&edit=1&returnTo=${encodeURIComponent(
        returnTo,
      )}`,
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/classroom"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-admin-border bg-white text-admin-text hover:bg-admin-surfaceMuted"
          aria-label="ย้อนกลับ"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>

        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-wide text-admin-textMuted">
            Edit User
          </div>
          <h1 className="text-lg font-semibold text-admin-text">
            แก้ไขข้อมูลผู้ที่เช็กอินแล้ว (อาหาร)
          </h1>
          <div className="text-sm text-admin-textMuted">
            ค้นหาได้เฉพาะ “ผู้ที่เช็คอินแล้วในวันนี้” ของ Day {day}
          </div>
        </div>

        <div className="rounded-xl border border-admin-border bg-white px-3 py-2 text-sm">
          Day:&nbsp;<b>{day}</b>
        </div>
      </div>

      <div className="rounded-2xl border border-admin-border bg-white p-5">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
            placeholder="ค้นหาชื่อ / บริษัท / เลขที่ QT/IV/RP"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") doSearch();
            }}
          />
          <button
            type="button"
            onClick={doSearch}
            className={cx(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium",
              loading
                ? "bg-admin-surfaceMuted text-admin-textMuted"
                : "bg-brand-primary text-white hover:bg-brand-primary/90",
            )}
            disabled={loading}
          >
            <Search className="h-4 w-4" />
            ค้นหา
          </button>
        </div>

        {err && (
          <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="mt-4 text-sm text-admin-textMuted">
          {loading
            ? "กำลังค้นหา..."
            : `พบ ${items.length} รายการ (เฉพาะผู้ที่เช็คอินแล้ว)`}
        </div>

        <div className="mt-3 space-y-2">
          {items.map((row) => {
            const name =
              row?.thaiName || row?.name || row?.engName || "(no name)";
            const company = row?.company || "-";
            const cls = row?.classInfo;
            const title = cls?.title || "-";
            const room = cls?.room ? ` • ห้อง ${cls.room}` : "";

            return (
              <button
                key={row._id}
                type="button"
                onClick={() => openFoodEdit(row)}
                className="w-full rounded-2xl border border-admin-border bg-white px-4 py-3 text-left shadow-sm transition hover:bg-admin-surfaceMuted"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-admin-text">
                      {name}
                    </div>
                    <div className="text-xs text-admin-textMuted">
                      {company}
                    </div>
                    <div className="mt-2 text-xs text-admin-textMuted">
                      Class: <span className="text-admin-text">{title}</span>
                      {room}
                    </div>
                  </div>

                  <div className="text-xs text-brand-primary">แก้ไขอาหาร →</div>
                </div>
              </button>
            );
          })}

          {!loading && items.length === 0 && (
            <div className="rounded-2xl border border-admin-border bg-admin-surfaceMuted p-4 text-sm text-admin-textMuted">
              พิมพ์คำค้นแล้วกดค้นหา (ระบบจะแสดงเฉพาะคนที่เช็คอินแล้วใน Day {day}
              ของ “คลาสที่มีอบรมวันนี้”)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
