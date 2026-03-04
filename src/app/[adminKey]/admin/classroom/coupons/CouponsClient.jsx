"use client";

import { useEffect, useMemo, useState } from "react";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function clean(x) {
  return String(x ?? "").trim();
}

function fmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function fmtDateTimeTH(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

const STATUS_OPTIONS = ["all", "issued", "redeemed", "void", "expired"];

export default function CouponsClient({ adminKey }) {
  const [q, setQ] = useState("");
  const [dayYMD, setDayYMD] = useState(""); // YYYY-MM-DD
  const [status, setStatus] = useState("all");
  const [merchantId, setMerchantId] = useState("all");

  const [page, setPage] = useState(1);
  const limit = 30;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [merchantOptions, setMerchantOptions] = useState([]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("limit", String(limit));
      if (clean(q)) sp.set("q", clean(q));
      if (clean(dayYMD)) sp.set("day", clean(dayYMD));
      if (status && status !== "all") sp.set("status", status);
      if (merchantId && merchantId !== "all") sp.set("merchantId", merchantId);

      const r = await fetch(`/api/admin/coupons?${sp.toString()}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || "LOAD_FAILED");

      setItems(j.items || []);
      setTotal(Number(j.total || 0));
      setMerchantOptions(j.merchants || []);
    } catch (e) {
      setErr(String(e?.message || "LOAD_FAILED"));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, merchantId]);

  // เวลาเปลี่ยน q/day ให้ reset page แล้วค่อย load
  useEffect(() => {
    setPage(1);
  }, [q, dayYMD]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, dayYMD]);

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Coupon Tracking</h1>
          <p className="text-sm text-slate-500">
            ค้นหา/กรองรายการคูปอง และตรวจสอบการใช้คูปองของแต่ละร้าน
          </p>
        </div>
        <a
          className="text-sm font-semibold text-blue-600 hover:underline"
          href={`/${adminKey}/admin/classroom`}
        >
          ← กลับ Dashboard
        </a>
      </div>

      {/* Filters */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-slate-500 mb-1">ค้นหา (ชื่อ/Ref/คอร์ส)</div>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="เช่น 9XP4364 หรือ John"
            />
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1">วันที่ (dayYMD)</div>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
              value={dayYMD}
              onChange={(e) => setDayYMD(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1">สถานะ</div>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1">ร้าน</div>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
            >
              <option value="all">ทั้งหมด</option>
              {merchantOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
          <div>รวม {total.toLocaleString("th-TH")} รายการ</div>
          <button
            className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50"
            onClick={load}
            disabled={loading}
          >
            {loading ? "กำลังโหลด..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {err ? (
          <div className="p-4 text-sm text-red-600">{err}</div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2">Ref</th>
                <th className="text-left px-3 py-2">ผู้ถือคูปอง</th>
                <th className="text-left px-3 py-2">คอร์ส</th>
                <th className="text-left px-3 py-2">ห้อง</th>
                <th className="text-left px-3 py-2">dayYMD</th>
                <th className="text-left px-3 py-2">สถานะ</th>
                <th className="text-left px-3 py-2">ร้านที่ใช้</th>
                <th className="text-right px-3 py-2">ยอดจริง</th>
                <th className="text-right px-3 py-2">ส่วนต่าง</th>
                <th className="text-left px-3 py-2">เวลาใช้</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={10}>
                    กำลังโหลด...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={10}>
                    ไม่พบรายการ
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2 font-semibold">{it.displayCode || "-"}</td>
                    <td className="px-3 py-2">{it.holderName || "-"}</td>
                    <td className="px-3 py-2">{it.courseName || "-"}</td>
                    <td className="px-3 py-2">{it.roomName || "-"}</td>
                    <td className="px-3 py-2">{it.dayYMD || "-"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cx(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                          it.status === "redeemed"
                            ? "bg-emerald-100 text-emerald-700"
                            : it.status === "issued"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-700"
                        )}
                      >
                        {it.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{it.merchantName || "-"}</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(it.spentAmount)}</td>
                    <td className={cx("px-3 py-2 text-right", it.diffAmount > 0 ? "text-red-600" : "text-emerald-700")}>
                      {it.diffAmount > 0 ? "+" : ""}
                      {fmtMoney(it.diffAmount)}
                    </td>
                    <td className="px-3 py-2">{fmtDateTimeTH(it.redeemedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-3 py-3 border-t bg-white">
          <div className="text-sm text-slate-500">
            หน้า {page} / {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              ก่อนหน้า
            </button>
            <button
              className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}