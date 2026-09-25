"use client";

// หน้า "ติดตามการสั่งอาหาร" — ออเดอร์อาหารกลางวันของวันหนึ่ง แยกตามคลาส
// ยกเลิก / เปิดเวลาพิเศษ (token เดิม) / ออก QR ใหม่ (token ใหม่) ผ่าน /api/admin/lunch/*
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, X } from "lucide-react";

import LunchStatusBadge, { LUNCH_STATUS_LABELS } from "@/components/shared/LunchStatusBadge";
import LunchQrCode from "@/components/shared/LunchQrCode";
import CouponCode from "@/app/lunch/[token]/_components/CouponCode";

const POLL_MS = 30_000;
const STATUS_FILTERS = ["all", "pending", "unassigned", "ordered", "at_shop", "cancelled"];

function todayBkk() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function hmBkk(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

async function safeJson(res) {
  const t = await res.text().catch(() => "");
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return {};
  }
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

function Modal({ children, onClose, testId }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        data-testid={testId}
        className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-admin-textMuted hover:bg-admin-surfaceMuted"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

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

function QrModal({ qr, onClose }) {
  return (
    <Modal onClose={onClose} testId="qr-modal">
      <h3 className="pr-8 text-base font-semibold text-admin-text">
        {qr.title}
      </h3>
      <p className="mt-1 text-sm text-admin-textMuted">{qr.name}</p>
      <div className="mt-4">
        <LunchQrCode path={qr.path} size={260} />
      </div>
      <p className="mt-3 text-center text-sm text-admin-text">
        สแกนด้วยมือถือเพื่อสั่งอาหาร · สั่งได้ถึง{" "}
        <span className="font-semibold">{hmBkk(qr.deadlineAt)} น.</span>
      </p>
      <p className="mt-1 text-center text-xs text-admin-textMuted">
        หรือให้ผู้เรียนเปิดจากเมนูบน tablet
      </p>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-admin-border px-4 py-2 text-sm text-admin-text hover:bg-admin-surfaceMuted"
        >
          ปิด
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- table ---------------- */

function CodeCell({ row }) {
  if (!row.couponCode) return <span className="text-admin-textMuted">-</span>;
  if (row.couponVoided) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="line-through decoration-red-500 decoration-2 opacity-60">
          <CouponCode code={row.couponCode} size="table" />
        </span>
        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-700">
          void
        </span>
      </div>
    );
  }
  return <CouponCode code={row.couponCode} size="table" />;
}

function ActionButtons({ row, busy, onCancel, onSpecial, onReissue }) {
  const btn =
    "rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 whitespace-nowrap";
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {row.status === "pending" || row.status === "unassigned" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onSpecial(row)}
          className={`${btn} bg-brand-primary/15 text-brand-primary hover:bg-brand-primary/25`}
        >
          เปิดพิเศษ 10 นาที
        </button>
      ) : null}
      {["pending", "unassigned", "ordered", "at_shop"].includes(row.status) ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onCancel(row)}
          className={`${btn} border border-red-200 text-red-600 hover:bg-red-50`}
        >
          ยกเลิก
        </button>
      ) : null}
      {row.canReissue ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onReissue(row)}
          className={`${btn} bg-green-100 text-green-700 hover:bg-green-200`}
        >
          ออก QR ใหม่
        </button>
      ) : null}
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

  async function post(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || "ทำรายการไม่สำเร็จ");
    return json;
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

  async function specialOpen(row) {
    setBusy(true);
    setActionError("");
    try {
      const r = await post("/api/admin/lunch/special-open", { orderId: row.orderId });
      setQr({ title: "เปิดเวลาพิเศษแล้ว", name: row.name, path: r.path, deadlineAt: r.deadlineAt });
      await load();
    } catch (e) {
      setActionError(`${row.name}: ${e.message}`);
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

  const counts = data?.counts || {};

  return (
    <div className="mx-auto w-full max-w-7xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-admin-text">ติดตามการสั่งอาหาร</h1>
          <p className="mt-1 text-sm text-admin-textMuted">
            ออเดอร์อาหารกลางวันของผู้เรียน · อัปเดตอัตโนมัติทุก 30 วินาที
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text hover:bg-admin-surfaceMuted disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          รีเฟรช
          {updatedAt ? (
            <span className="text-xs text-admin-textMuted">
              {updatedAt.toLocaleTimeString("th-TH", { hour12: false })}
            </span>
          ) : null}
        </button>
      </div>

      {/* filters */}
      <div className="mt-4 grid gap-3 rounded-2xl border border-admin-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-admin-textMuted">
          วันที่
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || todayBkk())}
            className="mt-1 w-full rounded-xl border border-admin-border px-3 py-2 text-sm text-admin-text"
          />
        </label>
        <label className="text-xs text-admin-textMuted">
          คลาส
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-admin-border px-3 py-2 text-sm text-admin-text"
          >
            <option value="">ทุกคลาส</option>
            {(data?.classes || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.room ? ` · ห้อง ${c.room}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-admin-textMuted">
          สถานะ
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-xl border border-admin-border px-3 py-2 text-sm text-admin-text"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "ทั้งหมด" : LUNCH_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-admin-textMuted">
          ค้นหาชื่อ
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-textMuted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ชื่อ / ชื่อเล่น"
              className="w-full rounded-xl border border-admin-border py-2 pl-9 pr-3 text-sm text-admin-text"
            />
          </span>
        </label>
      </div>

      {/* chips */}
      <div className="mt-4 flex flex-wrap gap-2" data-testid="status-chips">
        {STATUS_FILTERS.filter((s) => s !== "all").map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(status === s ? "all" : s)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
              status === s
                ? "border-brand-primary bg-brand-primary/10"
                : "border-admin-border bg-white hover:bg-admin-surfaceMuted"
            }`}
          >
            <LunchStatusBadge status={s} />
            <span className="font-semibold text-admin-text">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {loadError ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>
      ) : null}
      {actionError ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>
      ) : null}

      {/* table grouped by class */}
      <div className="mt-4 flex flex-col gap-4">
        {data && groups.length === 0 ? (
          <p className="rounded-2xl border border-admin-border bg-white p-6 text-center text-sm text-admin-textMuted">
            ไม่มีออเดอร์ตามตัวกรองนี้
          </p>
        ) : null}

        {groups.map((g) => (
          <div
            key={g.id}
            className="overflow-hidden rounded-2xl border border-admin-border bg-white"
          >
            <div className="flex items-center justify-between border-b border-admin-border bg-admin-surfaceMuted px-4 py-2.5">
              <div className="text-sm font-semibold text-admin-text">
                {g.name}
                {g.room ? (
                  <span className="ml-2 font-normal text-admin-textMuted">ห้อง {g.room}</span>
                ) : null}
              </div>
              <div className="text-xs text-admin-textMuted">{g.rows.length} คน</div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-admin-textMuted">
                  <th className="px-4 py-2 font-medium">ผู้เรียน</th>
                  <th className="px-2 py-2 font-medium">สถานะ</th>
                  <th className="px-2 py-2 font-medium">ร้าน</th>
                  <th className="px-2 py-2 font-medium">รหัสคูปอง</th>
                  <th className="px-2 py-2 font-medium">ที่มา</th>
                  <th className="px-2 py-2 text-right font-medium">ยอดรวม</th>
                  <th className="px-2 py-2 font-medium">เส้นตาย</th>
                  <th className="px-4 py-2 text-right font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr
                    key={r.orderId}
                    data-testid="order-row"
                    className="border-t border-admin-border align-middle"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-admin-text">{r.name || "-"}</div>
                      {r.nickname ? (
                        <div className="text-xs text-admin-textMuted">{r.nickname}</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5">
                      <LunchStatusBadge status={r.status} />
                    </td>
                    <td className="px-2 py-2.5 text-admin-text">{r.restaurantName || "-"}</td>
                    <td className="px-2 py-2.5">
                      <CodeCell row={r} />
                    </td>
                    <td className="px-2 py-2.5 text-xs text-admin-textMuted">
                      {r.couponSource === "stock"
                        ? "stock"
                        : r.couponSource === "ecoupon"
                          ? "e-coupon"
                          : "-"}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-admin-text">
                      {r.itemsTotal ? `${r.itemsTotal} ฿` : "-"}
                      {r.overBudget > 0 ? (
                        <div className="text-xs text-amber-700">เกิน {r.overBudget} ฿</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5 tabular-nums text-admin-text">
                      {r.deadlineHM || "-"}
                      {r.reopenCount > 0 ? (
                        <span className="ml-1 text-[10px] text-admin-textMuted">
                          (+{r.reopenCount})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <ActionButtons
                        row={r}
                        busy={busy}
                        onCancel={(row) => {
                          setCancelError("");
                          setCancelRow(row);
                        }}
                        onSpecial={specialOpen}
                        onReissue={reissue}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

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
    </div>
  );
}
