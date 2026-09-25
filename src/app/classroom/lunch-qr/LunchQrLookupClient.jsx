"use client";

// แท็บเล็ต: ค้นหาชื่อ -> แสดง QR สั่งอาหารของวันนี้ (หรือออก QR ถ้าเลือกคูปองแล้วแต่ยังไม่มีใบ)
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, QrCode, Search } from "lucide-react";

import LunchQrCode from "@/components/shared/LunchQrCode";
import LunchDeadlineLine from "@/components/shared/LunchDeadlineLine";
import LunchStatusBadge from "@/components/shared/LunchStatusBadge";

const MIN_Q = 2;
const QR_FAIL = "ออก QR สั่งอาหารไม่สำเร็จ กรุณาแจ้งเจ้าหน้าที่ที่ Counter";

/* ---------------- full-card QR view ---------------- */

function QrView({ view, onClose }) {
  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-6 py-8 text-center" data-testid="qr-view">
      <div className="text-2xl font-semibold text-front-text sm:text-3xl lg:text-xl">{view.name}</div>
      <div className="mt-1 text-front-textMuted sm:text-lg lg:text-sm">
        {view.className}
        {view.room ? ` · ห้อง ${view.room}` : ""}
      </div>
      <div className="mt-3">
        <LunchStatusBadge status={view.status} size="lg" />
      </div>

      <div className="mt-6 rounded-2xl border border-brand-border bg-white p-4">
        <LunchQrCode path={view.path} size={340} />
      </div>

      <p className="mt-5 font-semibold text-front-text sm:text-xl lg:text-lg">
        สแกนด้วยมือถือเพื่อสั่งอาหาร / ดูรหัสคูปอง
      </p>
      <LunchDeadlineLine
        deadlineAt={view.deadlineAt}
        phase={view.phase}
        status={view.status}
      />

      <button
        type="button"
        onClick={onClose}
        className="mt-6 w-full max-w-md rounded-xl bg-brand-primary px-4 py-3 font-semibold text-[#0D1B2A] hover:opacity-90 sm:text-xl lg:text-base"
      >
        ปิด
      </button>
    </div>
  );
}

/* ---------------- result card ---------------- */

function ResultCard({ it, issuing, issueError, onShow, onIssue }) {
  return (
    <div
      data-testid="lookup-card"
      className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#48B0FF]"
    >
      <div className="min-w-0">
        <div className="font-semibold text-[#0D1B2A] sm:text-2xl lg:text-base">{it.name || "-"}</div>
        <div className="mt-0.5 text-front-textMuted sm:text-lg lg:text-sm">
          {it.className}
          {it.room ? ` · ห้อง ${it.room}` : ""}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {it.order ? (
            <>
              <LunchStatusBadge status={it.order.status} />
              {it.order.restaurantName ? (
                <span className="text-front-textMuted sm:text-base lg:text-xs">
                  {it.order.restaurantName}
                </span>
              ) : null}
            </>
          ) : it.couponToday ? (
            <span className="text-front-textMuted sm:text-base lg:text-xs">
              เลือกรับคูปองแล้ว ยังไม่ได้ออก QR
            </span>
          ) : (
            <span className="text-slate-400 sm:text-base lg:text-sm" data-testid="no-coupon">
              วันนี้ไม่ได้เลือกรับคูปอง
            </span>
          )}
        </div>
        {issueError ? (
          <div className="mt-2" data-testid="issue-error">
            <p className="font-semibold text-red-600 sm:text-base lg:text-sm">{QR_FAIL}</p>
            <p className="mt-1 text-slate-400 sm:text-sm lg:text-xs">{issueError}</p>
          </div>
        ) : null}
      </div>

      {it.order ? (
        <button
          type="button"
          onClick={() => onShow(it)}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 font-semibold text-[#0D1B2A] hover:opacity-90 sm:text-lg lg:text-sm"
        >
          <QrCode aria-hidden="true" className="h-5 w-5" />
          แสดง QR
        </button>
      ) : it.couponToday ? (
        <button
          type="button"
          disabled={issuing}
          onClick={() => onIssue(it)}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 font-semibold text-[#0D1B2A] hover:opacity-90 disabled:opacity-50 sm:text-lg lg:text-sm"
        >
          <QrCode aria-hidden="true" className="h-5 w-5" />
          {issuing ? "กำลังออก QR…" : "ออก QR"}
        </button>
      ) : null}
    </div>
  );
}

/* ---------------- page ---------------- */

export default function LunchQrLookupClient() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState(null);
  const [issuingId, setIssuingId] = useState("");
  const [issueErrors, setIssueErrors] = useState({});
  const timer = useRef(null);

  async function search(keyword) {
    const k = keyword.trim();
    if (k.length < MIN_Q) {
      setItems(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/checkin/lunch-lookup?q=${encodeURIComponent(k)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "ค้นหาไม่สำเร็จ");
        setItems([]);
        return;
      }
      setItems(data.items || []);
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function onChange(e) {
    const v = e.target.value;
    setQ(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(v), 300);
  }

  function show(it) {
    setView({
      name: it.name,
      className: it.className,
      room: it.room,
      status: it.order.status,
      path: it.order.path,
      deadlineAt: it.order.deadlineAt,
      phase: it.order.phase,
    });
  }

  async function issue(it) {
    setIssuingId(it.studentId);
    setIssueErrors((m) => ({ ...m, [it.studentId]: "" }));
    try {
      const res = await fetch("/api/checkin/lunch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: it.studentId, classId: it.classId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.path) {
        setView({
          name: it.name,
          className: it.className,
          room: it.room,
          status: data.status || "pending",
          path: data.path,
          deadlineAt: data.deadlineAt,
          phase: data.phase,
        });
        search(q); // ให้การ์ดขึ้นสถานะใหม่หลังปิด
        return;
      }
      setIssueErrors((m) => ({
        ...m,
        [it.studentId]: [data?.error, data?.reason ? `(${data.reason})` : `(HTTP ${res.status})`]
          .filter(Boolean)
          .join(" "),
      }));
    } catch {
      setIssueErrors((m) => ({ ...m, [it.studentId]: "เชื่อมต่อไม่สำเร็จ (network)" }));
    } finally {
      setIssuingId("");
    }
  }

  if (view) return <QrView view={view} onClose={() => setView(null)} />;

  return (
    <div className="flex h-full min-h-0 flex-col px-6 py-6">
      <div className="flex items-center gap-3">
        <Link
          href="/classroom"
          aria-label="กลับเมนูหน้างาน"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-border bg-white text-front-text hover:bg-front-bgSoft"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-front-textMuted"
          />
          <input
            value={q}
            onChange={onChange}
            autoFocus
            placeholder="พิมพ์ชื่อผู้เรียน (อย่างน้อย 2 ตัวอักษร)"
            className="w-full rounded-2xl border border-brand-border bg-white py-3 pl-12 pr-4 outline-none focus:border-brand-primary sm:text-xl lg:text-base"
          />
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto p-1">
        {loading ? <p className="text-front-textMuted sm:text-lg lg:text-sm">กำลังค้นหา…</p> : null}
        {error ? <p className="text-red-600 sm:text-lg lg:text-sm">{error}</p> : null}
        {items && !loading && items.length === 0 && !error ? (
          <p className="text-front-textMuted sm:text-lg lg:text-sm">
            ไม่พบผู้เรียนของคลาสที่เรียนวันนี้
          </p>
        ) : null}
        {(items || []).map((it) => (
          <ResultCard
            key={it.studentId}
            it={it}
            issuing={issuingId === it.studentId}
            issueError={issueErrors[it.studentId]}
            onShow={show}
            onIssue={issue}
          />
        ))}
      </div>
    </div>
  );
}
