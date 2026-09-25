"use client";

// หน้า "Counter คูปองอาหาร" (iPad-first) — ค้นหาออเดอร์วันนี้ด้วยชื่อ/ชื่อเล่น/รหัสคูปอง
// ส่งมอบคูปองกระดาษ (stock), เปิดเวลาพิเศษ, และรับคูปองคืนจากออเดอร์ที่ถูกยกเลิก
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Search, PackageCheck, Undo2 } from "lucide-react";

import LunchStatusBadge from "@/components/shared/LunchStatusBadge";
import CouponCode from "@/app/lunch/[token]/_components/CouponCode";
import { QrModal, ConfirmModal, hmBkk } from "@/components/admin/lunch/LunchModals";
import { safeJson, postLunchAdmin } from "@/components/admin/lunch/lunchApi";

const POLL_MS = 30_000;
const MIN_Q = 2;

function sourceLabel(s) {
  if (s === "stock") return "คูปองกระดาษ (stock)";
  if (s === "ecoupon") return "e-coupon";
  return "-";
}

/* ---------------- result card ---------------- */

function OrderCard({ it, busy, onHandout, onSpecial }) {
  const placed = it.status === "ordered" || it.status === "at_shop";
  const isStock = it.couponSource === "stock";

  return (
    <div
      data-testid="counter-card"
      className="rounded-3xl border border-admin-border bg-white p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {/* ตัวใหญ่ไว้ตรวจตัวตนก่อนยื่นคูปอง */}
          <div className="text-3xl font-bold leading-tight text-admin-text">{it.name || "-"}</div>
          <div className="mt-1 text-2xl text-admin-text">
            ชื่อเล่น: <span className="font-semibold">{it.nickname || "-"}</span>
          </div>
          <div className="mt-2 text-base text-admin-textMuted">
            {it.className}
            {it.room ? ` · ห้อง ${it.room}` : ""}
            {it.restaurantName ? ` · ${it.restaurantName}` : ""}
          </div>
        </div>
        <LunchStatusBadge status={it.status} size="lg" />
      </div>

      {it.couponCode ? (
        <div className="mt-5 rounded-2xl bg-admin-surfaceMuted px-5 py-4">
          <div className="text-sm text-admin-textMuted">
            รหัสคูปอง · {sourceLabel(it.couponSource)}
            {it.couponVoided ? <span className="ml-2 font-semibold text-red-600">(ยกเลิกแล้ว)</span> : null}
          </div>
          <div className={it.couponVoided ? "line-through decoration-red-500 opacity-60" : ""}>
            <CouponCode code={it.couponCode} />
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        {placed && isStock && it.stockStatus === "assigned" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onHandout(it)}
            className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-brand-primary px-6 py-5 text-2xl font-semibold text-[#0D1B2A] hover:opacity-90 disabled:opacity-50"
          >
            <PackageCheck aria-hidden="true" className="h-7 w-7" />
            ส่งมอบคูปองแล้ว
          </button>
        ) : null}

        {isStock && it.handedOutAt ? (
          <p data-testid="handout-line" className="text-lg font-semibold text-green-700">
            ส่งมอบแล้ว {hmBkk(it.handedOutAt)} น.{it.handedOutBy ? ` โดย ${it.handedOutBy}` : ""}
          </p>
        ) : null}

        {placed && it.couponSource === "ecoupon" ? (
          <p className="text-base text-slate-400">e-coupon — ไม่ต้องส่งมอบคูปองกระดาษ</p>
        ) : null}

        {it.status === "pending" || it.status === "unassigned" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onSpecial(it)}
            className="inline-flex items-center justify-center rounded-2xl bg-brand-primary/15 px-6 py-4 text-xl font-semibold text-brand-primary hover:bg-brand-primary/25 disabled:opacity-50"
          >
            เปิดพิเศษ 10 นาที
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */

export default function LunchCounterPage() {
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  const [confirm, setConfirm] = useState(null); // { kind: "handout" | "return", item }
  const [confirmError, setConfirmError] = useState("");
  const [qr, setQr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (qDebounced.length >= MIN_Q) p.set("q", qDebounced);
      const res = await fetch(`/api/admin/lunch/counter?${p}`, { cache: "no-store" });
      const json = await safeJson(res);
      if (!res.ok) {
        setLoadError(json.error || "โหลดข้อมูลไม่สำเร็จ");
        return;
      }
      setData(json);
      setLoadError("");
      setUpdatedAt(new Date());
    } catch {
      setLoadError("เชื่อมต่อไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [qDebounced]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  async function doConfirm() {
    setBusy(true);
    setConfirmError("");
    try {
      if (confirm.kind === "handout") {
        await postLunchAdmin("/api/admin/lunch/handout", { orderId: confirm.item.orderId });
      } else {
        await postLunchAdmin("/api/admin/lunch/return", { codeId: confirm.item.codeId });
      }
      setConfirm(null);
      await load();
    } catch (e) {
      setConfirmError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function specialOpen(it) {
    setBusy(true);
    setActionError("");
    try {
      const r = await postLunchAdmin("/api/admin/lunch/special-open", { orderId: it.orderId });
      setQr({ title: "เปิดเวลาพิเศษแล้ว", name: it.name, path: r.path, deadlineAt: r.deadlineAt });
      await load();
    } catch (e) {
      setActionError(`${it.name}: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  const items = data?.items || [];
  const awaiting = data?.awaitingReturn || [];

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-admin-text">Counter คูปองอาหาร</h1>
          <p className="mt-1 text-sm text-admin-textMuted">
            ค้นหาด้วยชื่อ ชื่อเล่น หรือรหัสคูปอง · ออเดอร์ของวันนี้
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-admin-border bg-white px-4 py-2.5 text-base text-admin-text hover:bg-admin-surfaceMuted disabled:opacity-60"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          รีเฟรช
          {updatedAt ? (
            <span className="text-sm text-admin-textMuted">
              {updatedAt.toLocaleTimeString("th-TH", { hour12: false })}
            </span>
          ) : null}
        </button>
      </div>

      <div className="relative mt-5">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-5 top-1/2 h-7 w-7 -translate-y-1/2 text-admin-textMuted"
        />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          placeholder="ชื่อ / ชื่อเล่น / รหัสคูปอง"
          className="h-16 w-full rounded-2xl border border-admin-border bg-white pl-16 pr-5 text-2xl text-admin-text outline-none focus:border-brand-primary"
        />
      </div>

      {loadError ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-base text-red-700">{loadError}</p>
      ) : null}
      {actionError ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-base text-red-700">{actionError}</p>
      ) : null}

      <div className="mt-5 flex flex-col gap-4">
        {qDebounced.length >= MIN_Q && data && items.length === 0 ? (
          <p className="rounded-2xl border border-admin-border bg-white p-6 text-center text-lg text-admin-textMuted">
            ไม่พบออเดอร์ของวันนี้ที่ตรงกับ “{qDebounced}”
          </p>
        ) : null}
        {items.map((it) => (
          <OrderCard
            key={it.orderId}
            it={it}
            busy={busy}
            onHandout={(item) => {
              setConfirmError("");
              setConfirm({ kind: "handout", item });
            }}
            onSpecial={specialOpen}
          />
        ))}
      </div>

      {/* รอรับคูปองคืน */}
      <div className="mt-8 overflow-hidden rounded-3xl border border-admin-border bg-white" data-testid="awaiting-return">
        <div className="flex items-center justify-between border-b border-admin-border bg-amber-50 px-5 py-3">
          <div className="flex items-center gap-2 text-lg font-semibold text-amber-900">
            <Undo2 aria-hidden="true" className="h-5 w-5" />
            รอรับคูปองคืน
          </div>
          <div className="text-sm text-amber-800">{awaiting.length} ใบ</div>
        </div>
        {awaiting.length === 0 ? (
          <p className="px-5 py-6 text-center text-base text-admin-textMuted">ไม่มีคูปองที่รอรับคืน</p>
        ) : (
          <ul>
            {awaiting.map((a) => (
              <li
                key={a.codeId}
                data-testid="awaiting-row"
                className="flex flex-wrap items-center justify-between gap-4 border-t border-admin-border px-5 py-4 first:border-t-0"
              >
                <div className="min-w-0">
                  <div className="text-xl font-semibold text-admin-text">
                    {a.name || "-"}
                    {a.nickname ? (
                      <span className="ml-2 font-normal text-admin-textMuted">({a.nickname})</span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-sm text-admin-textMuted">
                    {a.restaurantName || "-"} · ยกเลิกเมื่อ {a.dayYMD} {hmBkk(a.cancelledAt)} น.
                  </div>
                  <div className="mt-1">
                    <CouponCode code={a.code} size="table" />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setConfirmError("");
                    setConfirm({ kind: "return", item: a });
                  }}
                  className="rounded-2xl bg-amber-100 px-5 py-3 text-lg font-semibold text-amber-900 hover:bg-amber-200 disabled:opacity-50"
                >
                  ได้รับคืนแล้ว
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirm ? (
        <ConfirmModal
          testId={confirm.kind === "handout" ? "handout-confirm" : "return-confirm"}
          title={
            confirm.kind === "handout"
              ? "ยืนยันส่งมอบคูปองกระดาษให้ผู้เรียนคนนี้?"
              : "ยืนยันได้รับคูปองกระดาษคืนแล้ว?"
          }
          confirmLabel={confirm.kind === "handout" ? "ส่งมอบคูปองแล้ว" : "ได้รับคืนแล้ว"}
          busy={busy}
          error={confirmError}
          onClose={() => setConfirm(null)}
          onConfirm={doConfirm}
        >
          <div className="rounded-2xl bg-admin-surfaceMuted px-5 py-4">
            <div className="text-2xl font-bold text-admin-text">{confirm.item.name || "-"}</div>
            <div className="mt-1 text-xl text-admin-text">
              ชื่อเล่น: <span className="font-semibold">{confirm.item.nickname || "-"}</span>
            </div>
            <div className="mt-3 text-sm text-admin-textMuted">รหัสคูปอง</div>
            <CouponCode code={confirm.item.couponCode || confirm.item.code} />
          </div>
        </ConfirmModal>
      ) : null}
      {qr ? <QrModal qr={qr} onClose={() => setQr(null)} /> : null}
    </div>
  );
}
