"use client";

// หน้า "ติดตามการสั่งอาหาร" — ออเดอร์อาหารกลางวันของวันหนึ่ง แยกตามคลาส
// ยกเลิก / ออก QR ใหม่ (token ใหม่) ผ่าน /api/admin/lunch/*
// C1: ไม่มี "เปิดพิเศษ" แล้ว — ยกเลิก + ออก QR ใหม่ ได้เฉพาะคนที่เคยสั่งแล้ว และก่อน 15:00
// R3b: หน้าตาใหม่ (การ์ดสถานะ / การ์ดคลาสพับได้ / drawer รายละเอียด) — endpoint + payload เดิม
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, RefreshCw, Search } from "lucide-react";

import { LUNCH_STATUS_LABELS } from "@/components/shared/LunchStatusBadge";
import CouponCode from "@/app/lunch/[token]/_components/CouponCode";
import { Modal, QrModal, ConfirmModal } from "@/components/admin/lunch/LunchModals";
import { safeJson, postLunchAdmin } from "@/components/admin/lunch/lunchApi";

import { STATUS_KEYS, STATUS_META } from "./_components/lunchOrdersUi";
import ClassSection from "./_components/ClassSection";
import OrderDrawer from "./_components/OrderDrawer";

const POLL_MS = 30_000;
const STATUS_FILTERS = ["all", ...STATUS_KEYS];

const FIELD =
  "mt-1.5 h-10 w-full rounded-xl border border-admin-border bg-white px-3 text-sm text-admin-text outline-none focus:border-brand-primary";

function todayBkk() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** ผลของการยกเลิกต่อคูปอง (ข้อความในโมดัล) */
function couponEffectText(row) {
  if (row.stockStatus === "assigned") return "รหัสคูปองจะคืนเข้าคลัง";
  if (row.stockStatus === "handed_out") {
    return "คูปองกระดาษถูกส่งมอบแล้ว ต้องรับคืนจากผู้เรียน";
  }
  if (row.couponSource === "ecoupon" && row.couponCode) {
    return "e-coupon นี้จะถูกยกเลิก ห้ามร้านรับ";
  }
  return "ยังไม่มีการออกรหัสคูปองให้ออเดอร์นี้";
}

/* ---------------- modals ---------------- */

function CancelModal({ row, busy, error, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  return (
    <Modal onClose={onClose} testId="cancel-modal">
      <h3 className="pr-8 text-base font-semibold text-admin-text">
        ยกเลิกออเดอร์ของ {row.name}?
      </h3>
      <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {couponEffectText(row)}
      </p>
      <label className="mt-4 block text-xs text-admin-textMuted" htmlFor="cancel-reason">
        เหตุผล (ไม่บังคับ)
      </label>
      <textarea
        id="cancel-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={300}
        rows={2}
        className="mt-1 w-full resize-none rounded-xl border border-admin-border px-3 py-2 text-sm outline-none focus:border-brand-primary"
      />
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-xl border border-admin-border px-4 py-2 text-sm text-admin-text hover:bg-admin-surfaceMuted disabled:opacity-50"
        >
          ปิด
        </button>
        <button
          type="button"
          data-testid="cancel-confirm"
          onClick={() => onConfirm(reason)}
          disabled={busy}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? "กำลังยกเลิก…" : "ยืนยันยกเลิก"}
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- header bits ---------------- */

function StatusCards({ counts, active, onPick }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" data-testid="status-chips">
      {STATUS_KEYS.map((s) => {
        const m = STATUS_META[s];
        const on = active === s;
        return (
          <button
            key={s}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(on ? "all" : s)}
            className={`flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition sm:p-4 ${m.card} ${
              on ? `ring-2 ${m.ring}` : "hover:brightness-[0.98]"
            }`}
          >
            <span
              className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${m.icon}`}
            >
              <m.Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className={`block truncate text-sm font-semibold ${m.text}`}>
                {LUNCH_STATUS_LABELS[s]}
              </span>
              <span className="block text-admin-text">
                <span className="text-2xl font-semibold tabular-nums">{counts[s] ?? 0}</span>{" "}
                <span className="text-sm">คน</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- page ---------------- */

export default function LunchOrdersPage() {
  const [date, setDate] = useState(todayBkk);
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  const [cancelRow, setCancelRow] = useState(null);
  const [cancelError, setCancelError] = useState("");
  const [qr, setQr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [stockAction, setStockAction] = useState(null); // { kind: "handout" | "return", row }
  const [stockError, setStockError] = useState("");

  const [collapsed, setCollapsed] = useState(() => new Set());
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ date, status });
      if (classId) p.set("classId", classId);
      if (qDebounced) p.set("q", qDebounced);
      const res = await fetch(`/api/admin/lunch/orders?${p}`, { cache: "no-store" });
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
  }, [date, status, classId, qDebounced]);

  // โหลดทันทีเมื่อเปลี่ยนตัวกรอง + ทุก 30 วินาที
  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const groups = useMemo(() => {
    if (!data) return [];
    const byClass = new Map();
    for (const it of data.items || []) {
      if (!byClass.has(it.classId)) byClass.set(it.classId, []);
      byClass.get(it.classId).push(it);
    }
    return (data.classes || [])
      .filter((c) => byClass.has(c.id))
      .map((c) => ({
        ...c,
        rows: byClass.get(c.id).sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [data]);

  // แถวที่เลือก = ข้อมูลล่าสุดหลังรีเฟรช; หายจากรายการ (เช่นถูกกรองออก) -> drawer ปิด
  const selected = useMemo(
    () => (selectedId ? (data?.items || []).find((it) => it.orderId === selectedId) || null : null),
    [data, selectedId],
  );
  const closeDrawer = useCallback(() => setSelectedId(""), []);

  const post = postLunchAdmin;

  // P4b: ส่งมอบ / รับคืน (ยืนยันก่อนทุกครั้ง)
  async function confirmStockAction() {
    const { kind, row } = stockAction;
    setBusy(true);
    setStockError("");
    try {
      if (kind === "handout") {
        await post("/api/admin/lunch/handout", { orderId: row.orderId });
      } else {
        await post("/api/admin/lunch/return", { codeId: row.stockCodeId });
      }
      setStockAction(null);
      await load();
    } catch (e) {
      setStockError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancel(reason) {
    setBusy(true);
    setCancelError("");
    try {
      await post("/api/admin/lunch/cancel", { orderId: cancelRow.orderId, reason });
      setCancelRow(null);
      await load();
    } catch (e) {
      setCancelError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function reissue(row) {
    setBusy(true);
    setActionError("");
    try {
      const r = await post("/api/admin/lunch/reopen", {
        classId: row.classId,
        studentId: row.studentId,
        dayYMD: row.dayYMD,
      });
      setQr({ title: "ออก QR ใหม่แล้ว", name: row.name, path: r.path, deadlineAt: r.deadlineAt });
      await load();
    } catch (e) {
      setActionError(`${row.name}: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  // ปุ่มในตารางและใน drawer ใช้ handler ชุดเดียวกัน
  const actionProps = {
    busy,
    onCancel: (row) => {
      setCancelError("");
      setCancelRow(row);
    },
    onReissue: reissue,
    onHandout: (row) => {
      setStockError("");
      setStockAction({ kind: "handout", row });
    },
    onReturn: (row) => {
      setStockError("");
      setStockAction({ kind: "return", row });
    },
  };

  function toggleClass(id) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const counts = data?.counts || {};
  const modalOpen = !!(cancelRow || qr || stockAction);

  return (
    // layout แม่ (<main>) เป็น overflow-hidden — หน้านี้ scroll เอง
    <div className="flex h-full min-w-0 flex-col overflow-y-auto overflow-x-hidden overscroll-contain pr-1">
      <div className="flex w-full flex-col gap-4 pb-6">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold text-admin-text">
              ติดตามการสั่งอาหาร
              {/* C2d: preview/dev ที่เลื่อนเวลาปิดไว้ */}
              {data?.testTimes ? (
                <span
                  data-testid="lunch-test-times"
                  className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-amber-800"
                >
                  {data.testTimes}
                </span>
              ) : null}
            </h1>
            <p className="mt-0.5 text-sm text-admin-textMuted">
              อัปเดตข้อมูลการสั่งอาหารของผู้เรียนอัตโนมัติทุก 30 วินาที
              {updatedAt ? (
                <span className="ml-1 tabular-nums">
                  · ล่าสุด {updatedAt.toLocaleTimeString("th-TH", { hour12: false })}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-admin-border bg-white px-4 text-sm font-semibold text-brand-primaryDark shadow-sm hover:bg-admin-surfaceMuted disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              รีเฟรช
            </button>
          </div>
        </div>

        {/* filters */}
        <div className="grid gap-3 rounded-2xl border border-admin-border bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-admin-text">
            วันที่
            <span className="relative block">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 mt-[3px] h-4 w-4 -translate-y-1/2 text-admin-textMuted" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value || todayBkk())}
                className={`${FIELD} pl-9`}
              />
            </span>
          </label>
          <label className="text-xs font-medium text-admin-text">
            คลาส
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className={FIELD}>
              <option value="">ทุกคลาส</option>
              {(data?.classes || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.room ? ` · ห้อง ${c.room}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-admin-text">
            สถานะ
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={FIELD}>
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "ทั้งหมด" : LUNCH_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-admin-text">
            ค้นหาชื่อ
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 mt-[3px] h-4 w-4 -translate-y-1/2 text-admin-textMuted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ชื่อ / ชื่อเล่น"
                className={`${FIELD} pl-9`}
              />
            </span>
          </label>
        </div>

        {/* status cards — กดเพื่อกรอง, กดซ้ำเพื่อล้าง */}
        <StatusCards counts={counts} active={status} onPick={setStatus} />

        {loadError ? (
          <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </p>
        ) : null}
        {actionError ? (
          <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </p>
        ) : null}

        {/* class sections */}
        {!data && loading ? (
          <p className="rounded-2xl border border-admin-border bg-white p-6 text-center text-sm text-admin-textMuted">
            กำลังโหลด…
          </p>
        ) : null}
        {data && groups.length === 0 ? (
          <p className="rounded-2xl border border-admin-border bg-white p-6 text-center text-sm text-admin-textMuted">
            ไม่มีออเดอร์ตามตัวกรองนี้
          </p>
        ) : null}

        {groups.map((g) => (
          <ClassSection
            key={g.id}
            group={g}
            open={!collapsed.has(g.id)}
            onToggle={() => toggleClass(g.id)}
            selectedId={selected ? selectedId : ""}
            onSelect={setSelectedId}
            actionProps={actionProps}
          />
        ))}
      </div>

      {selected ? (
        <OrderDrawer
          row={selected}
          error={actionError}
          actionProps={actionProps}
          blockEsc={modalOpen}
          onClose={closeDrawer}
        />
      ) : null}

      {cancelRow ? (
        <CancelModal
          row={cancelRow}
          busy={busy}
          error={cancelError}
          onClose={() => setCancelRow(null)}
          onConfirm={confirmCancel}
        />
      ) : null}
      {qr ? <QrModal qr={qr} onClose={() => setQr(null)} /> : null}
      {stockAction ? (
        <ConfirmModal
          title={
            stockAction.kind === "handout"
              ? "ยืนยันส่งมอบคูปองกระดาษ?"
              : "ยืนยันได้รับคูปองคืนแล้ว?"
          }
          confirmLabel={stockAction.kind === "handout" ? "ส่งมอบแล้ว" : "ได้รับคืนแล้ว"}
          busy={busy}
          error={stockError}
          onClose={() => setStockAction(null)}
          onConfirm={confirmStockAction}
        >
          <p className="text-base font-semibold text-admin-text">
            {stockAction.row.name}
            {stockAction.row.nickname ? ` (${stockAction.row.nickname})` : ""}
          </p>
          <div className="mt-2">
            <CouponCode code={stockAction.row.couponCode} size="table" />
          </div>
        </ConfirmModal>
      ) : null}
    </div>
  );
}
