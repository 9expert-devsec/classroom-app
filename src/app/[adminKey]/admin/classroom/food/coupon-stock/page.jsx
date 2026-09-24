"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TextInput from "@/components/ui/TextInput";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { AlertTriangle } from "lucide-react";

const STATUS_LABELS = {
  available: "พร้อมใช้",
  assigned: "ผูกแล้ว",
  handed_out: "ส่งมอบแล้ว",
  awaiting_return: "รอคืน",
  void: "ยกเลิก",
};

const STATUS_STYLES = {
  available: "bg-green-100 text-green-700",
  assigned: "bg-blue-100 text-blue-700",
  handed_out: "bg-brand-primary/15 text-brand-primary",
  awaiting_return: "bg-amber-100 text-amber-700",
  void: "bg-red-100 text-red-700",
};

async function safeJson(res) {
  const t = await res.text().catch(() => "");
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
}

function StatCard({ label, value, tone = "" }) {
  return (
    <div className="rounded-2xl border border-admin-border bg-white p-3">
      <div className="text-[11px] text-admin-textMuted">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

export default function CouponStockPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantId, setRestaurantId] = useState("");

  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // import
  const [importBatch, setImportBatch] = useState("");
  const [expiresYMD, setExpiresYMD] = useState("");
  const [codesText, setCodesText] = useState("");
  const [preview, setPreview] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  // list
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fStatus, setFStatus] = useState("");
  const [fBatch, setFBatch] = useState("");
  const [q, setQ] = useState("");
  const [loadingRows, setLoadingRows] = useState(false);

  /* ---------- restaurants (เฉพาะร้านที่ใช้ stock) ---------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/food/restaurants", {
          cache: "no-store",
        });
        const data = await safeJson(res);
        const stockOnes = (data.items || []).filter((r) => r.usesCouponStock);
        setRestaurants(stockOnes);
        if (stockOnes.length > 0) setRestaurantId(String(stockOnes[0]._id));
      } catch (err) {
        console.error(err);
        alert("โหลดรายชื่อร้านไม่สำเร็จ");
      }
    })();
  }, []);

  const loadSummary = useCallback(async () => {
    if (!restaurantId) return;
    setLoadingSummary(true);
    try {
      const res = await fetch(
        `/api/admin/food/coupon-stock/summary?restaurantId=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store" },
      );
      const data = await safeJson(res);
      if (!res.ok) {
        console.error(data);
        return alert(data.error || "โหลดสรุปคลังคูปองไม่สำเร็จ");
      }
      setSummary(data);
    } catch (err) {
      console.error(err);
      alert("โหลดสรุปคลังคูปองไม่สำเร็จ");
    } finally {
      setLoadingSummary(false);
    }
  }, [restaurantId]);

  const loadRows = useCallback(async () => {
    if (!restaurantId) return;
    setLoadingRows(true);
    try {
      const qs = new URLSearchParams({ restaurantId, page: String(page) });
      if (fStatus) qs.set("status", fStatus);
      if (fBatch) qs.set("batch", fBatch);
      if (q.trim()) qs.set("q", q.trim());

      const res = await fetch(`/api/admin/food/coupon-stock?${qs.toString()}`, {
        cache: "no-store",
      });
      const data = await safeJson(res);
      if (!res.ok) {
        console.error(data);
        return alert(data.error || "โหลดรายการคูปองไม่สำเร็จ");
      }
      setRows(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
      alert("โหลดรายการคูปองไม่สำเร็จ");
    } finally {
      setLoadingRows(false);
    }
  }, [restaurantId, page, fStatus, fBatch, q]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // เปลี่ยนร้านแล้วรีเซ็ตทุกอย่าง
  useEffect(() => {
    setPage(1);
    setPreview(null);
    setFStatus("");
    setFBatch("");
    setQ("");
  }, [restaurantId]);

  /* ---------- import ---------- */
  async function handlePreview() {
    if (!codesText.trim()) return alert("กรุณาวางรหัสคูปองก่อน");
    if (!expiresYMD) return alert("กรุณาระบุวันหมดอายุ");

    setChecking(true);
    try {
      const res = await fetch("/api/admin/food/coupon-stock/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          codesText,
          importBatch,
          expiresYMD,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        console.error(data);
        setPreview(null);
        return alert(data.error || "ตรวจสอบไม่สำเร็จ");
      }
      setPreview(data);
    } catch (err) {
      console.error(err);
      alert("ตรวจสอบไม่สำเร็จ");
    } finally {
      setChecking(false);
    }
  }

  async function handleImport() {
    if (!preview || preview.counts.valid === 0) return;
    if (
      !confirm(
        `ยืนยันบันทึก ${preview.counts.valid} รหัส เข้าล็อต "${importBatch || "(ไม่ระบุ)"}" หมดอายุ ${expiresYMD}?`,
      )
    )
      return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/food/coupon-stock/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          codesText,
          importBatch,
          expiresYMD,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        console.error(data);
        return alert(data.error || "บันทึกไม่สำเร็จ");
      }
      alert(`บันทึกแล้ว ${data.inserted} รหัส`);
      setCodesText("");
      setPreview(null);
      await Promise.all([loadSummary(), loadRows()]);
    } catch (err) {
      console.error(err);
      alert("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  /* ---------- row actions ---------- */
  async function patchCode(id, payload, confirmMsg) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    try {
      const res = await fetch(`/api/admin/food/coupon-stock/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        console.error(data);
        return alert(data.error || "ทำรายการไม่สำเร็จ");
      }
      await Promise.all([loadSummary(), loadRows()]);
    } catch (err) {
      console.error(err);
      alert("ทำรายการไม่สำเร็จ");
    }
  }

  async function handleVoid(row) {
    const reason = prompt(`เหตุผลที่ยกเลิกรหัส ${row.code}:`, "");
    if (reason === null) return;
    if (!reason.trim()) return alert("กรุณาระบุเหตุผล");
    await patchCode(row._id, { action: "void", reason });
  }

  async function handleDelete(row) {
    if (!confirm(`ลบรหัส ${row.code} ออกจากคลังถาวร?`)) return;
    try {
      const res = await fetch(`/api/admin/food/coupon-stock/${row._id}`, {
        method: "DELETE",
      });
      const data = await safeJson(res);
      if (!res.ok) {
        console.error(data);
        return alert(data.error || "ลบไม่สำเร็จ");
      }
      await Promise.all([loadSummary(), loadRows()]);
    } catch (err) {
      console.error(err);
      alert("ลบไม่สำเร็จ");
    }
  }

  const batchOptions = useMemo(
    () =>
      Array.from(
        new Set((summary?.batches || []).map((b) => b.importBatch).filter(Boolean)),
      ),
    [summary],
  );

  const today = summary?.today || "";

  return (
    <div className="h-full space-y-6 overflow-y-auto overscroll-contain pr-1">
      <div>
        <h1 className="text-xl font-semibold">คลังคูปอง Stock</h1>
        <p className="text-sm text-admin-textMuted">
          จัดการคูปองกระดาษที่รับมาจากร้าน แยกตามล็อตและวันหมดอายุ
        </p>
      </div>

      {/* ร้าน */}
      <div className="rounded-2xl bg-admin-surface p-4 shadow-slate-950/20">
        <label className="block text-sm">
          <span className="text-admin-text">ร้านที่ใช้คูปอง stock</span>
          <select
            value={restaurantId}
            onChange={(e) => setRestaurantId(e.target.value)}
            className="mt-1 w-full max-w-md rounded-xl border border-brand-border bg-white p-2 text-base text-front-text outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          >
            {restaurants.map((r) => (
              <option key={String(r._id)} value={String(r._id)}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        {restaurants.length === 0 && (
          <p className="mt-2 text-xs text-admin-textMuted">
            ยังไม่มีร้านที่เปิด &quot;ร้านนี้ใช้คูปอง stock&quot; — ไปเปิดได้ที่หน้า
            Food Menu → เลือกร้าน → การใช้งานคูปอง
          </p>
        )}
      </div>

      {summary && (
        <>
          {summary.isLow && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              <div className="text-sm text-amber-800">
                <div className="font-semibold">คูปองใกล้หมด</div>
                <div className="mt-0.5">
                  เหลือพร้อมใช้ {summary.availableNotExpired} ใบ (เกณฑ์เตือนคือ{" "}
                  {summary.restaurant.couponStockLowThreshold} ใบ) — ควรรับล็อตใหม่จากร้าน
                </div>
              </div>
            </div>
          )}

          {/* สรุป */}
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard
              label="พร้อมใช้ (ยังไม่หมดอายุ)"
              value={summary.availableNotExpired}
              tone="text-green-700"
            />
            <StatCard label="ผูกแล้ว" value={summary.byStatus.assigned} />
            <StatCard label="ส่งมอบแล้ว" value={summary.byStatus.handed_out} />
            <StatCard
              label="รอคืน"
              value={summary.byStatus.awaiting_return}
              tone={summary.byStatus.awaiting_return > 0 ? "text-amber-700" : ""}
            />
            <StatCard label="ยกเลิก (void)" value={summary.byStatus.void} />
            <StatCard
              label="หมดอายุแต่ยังไม่ได้ใช้"
              value={summary.expiredStillAvailable}
              tone={summary.expiredStillAvailable > 0 ? "text-red-700" : ""}
            />
            <StatCard
              label="ใกล้หมดอายุ (7 วัน)"
              value={summary.expiringSoon}
              tone={summary.expiringSoon > 0 ? "text-amber-700" : ""}
            />
            <StatCard label="ทั้งหมดในคลัง" value={summary.byStatus.available} />
          </div>

          {/* ล็อต */}
          <div className="rounded-2xl bg-admin-surface p-4 shadow-slate-950/20">
            <h2 className="mb-3 text-base font-semibold">แยกตามล็อต</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-[11px] text-admin-textMuted">
                  <tr>
                    <th className="pb-2">ล็อต</th>
                    <th className="pb-2">หมดอายุ</th>
                    <th className="pb-2 text-right">ทั้งหมด</th>
                    <th className="pb-2 text-right">พร้อมใช้</th>
                    <th className="pb-2 text-right">ผูกแล้ว</th>
                    <th className="pb-2 text-right">ส่งมอบ</th>
                    <th className="pb-2 text-right">รอคืน</th>
                    <th className="pb-2 text-right">ยกเลิก</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.batches.map((b, i) => {
                    const expired = today && b.expiresYMD && b.expiresYMD < today;
                    return (
                      <tr
                        key={`${b.importBatch}-${b.expiresYMD}-${i}`}
                        className="border-t border-admin-border/60"
                      >
                        <td className="py-1.5">{b.importBatch || "—"}</td>
                        <td className="py-1.5">
                          <span className={expired ? "text-red-600" : ""}>
                            {b.expiresYMD || "—"}
                            {expired ? " (หมดอายุ)" : ""}
                          </span>
                        </td>
                        <td className="py-1.5 text-right">{b.total}</td>
                        <td className="py-1.5 text-right">{b.available}</td>
                        <td className="py-1.5 text-right">{b.assigned}</td>
                        <td className="py-1.5 text-right">{b.handedOut}</td>
                        <td className="py-1.5 text-right">{b.awaitingReturn}</td>
                        <td className="py-1.5 text-right">{b.voided}</td>
                      </tr>
                    );
                  })}
                  {summary.batches.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-3 text-xs text-admin-textMuted">
                        ยังไม่มีคูปองในคลัง
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* import */}
      <div className="rounded-2xl bg-admin-surface p-4 shadow-slate-950/20">
        <h2 className="mb-3 text-base font-semibold">นำเข้าคูปองล็อตใหม่</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-admin-text">ชื่อล็อต</span>
            <TextInput
              value={importBatch}
              onChange={(e) => setImportBatch(e.target.value)}
              placeholder="เช่น CASA-2026-10"
            />
          </label>
          <label className="block text-sm">
            <span className="text-admin-text">วันหมดอายุ</span>
            <TextInput
              type="date"
              value={expiresYMD}
              onChange={(e) => setExpiresYMD(e.target.value)}
            />
          </label>
        </div>

        <label className="mt-3 block text-sm">
          <span className="text-admin-text">
            วางรหัสคูปอง บรรทัดละ 1 รหัส
          </span>
          <textarea
            value={codesText}
            onChange={(e) => {
              setCodesText(e.target.value);
              setPreview(null);
            }}
            rows={8}
            placeholder={"0DDD4C11118503333536\n0DDD4C11118503333537\n..."}
            className="mt-1 w-full rounded-xl border border-brand-border bg-white p-2 font-mono text-sm text-front-text outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={checking || !restaurantId}
            className="rounded-xl border border-admin-border bg-white px-4 py-2 text-sm font-medium hover:bg-admin-surfaceMuted disabled:opacity-60"
          >
            {checking ? "กำลังตรวจสอบ..." : "ตรวจสอบ"}
          </button>

          {preview && preview.counts.valid > 0 && (
            <PrimaryButton onClick={handleImport} disabled={saving}>
              {saving ? "กำลังบันทึก..." : `บันทึก ${preview.counts.valid} รหัส`}
            </PrimaryButton>
          )}
        </div>

        {preview && (
          <div className="mt-3 space-y-2 rounded-xl border border-admin-border bg-white p-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-green-50 p-2">
                <div className="text-[11px] text-green-700">ใหม่ พร้อมบันทึก</div>
                <div className="text-lg font-semibold text-green-700">
                  {preview.counts.valid}
                </div>
              </div>
              <div className="rounded-lg bg-amber-50 p-2">
                <div className="text-[11px] text-amber-700">ซ้ำในข้อความที่วาง</div>
                <div className="text-lg font-semibold text-amber-700">
                  {preview.counts.duplicate}
                </div>
              </div>
              <div className="rounded-lg bg-admin-surfaceMuted p-2">
                <div className="text-[11px] text-admin-textMuted">มีในคลังอยู่แล้ว</div>
                <div className="text-lg font-semibold">{preview.counts.exists}</div>
              </div>
              <div className="rounded-lg bg-red-50 p-2">
                <div className="text-[11px] text-red-700">รูปแบบไม่ถูกต้อง</div>
                <div className="text-lg font-semibold text-red-700">
                  {preview.counts.invalid}
                </div>
              </div>
            </div>

            {preview.counts.invalid > 0 && (
              <div className="text-[11px] text-red-700">
                ไม่ถูกต้อง:{" "}
                {preview.invalid.slice(0, 10).map((x) => x.raw).join(", ")}
                {preview.invalid.length > 10 ? " ..." : ""}
              </div>
            )}
            {preview.counts.exists > 0 && (
              <div className="text-[11px] text-admin-textMuted">
                มีอยู่แล้ว:{" "}
                {preview.exists.slice(0, 10).map((x) => x.code).join(", ")}
                {preview.exists.length > 10 ? " ..." : ""}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ตารางรหัส */}
      <div className="rounded-2xl bg-admin-surface p-4 shadow-slate-950/20">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-base font-semibold">รายการคูปอง ({total})</h2>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={fStatus}
              onChange={(e) => {
                setFStatus(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs"
            >
              <option value="">ทุกสถานะ</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>

            <select
              value={fBatch}
              onChange={(e) => {
                setFBatch(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs"
            >
              <option value="">ทุกล็อต</option>
              {batchOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="ค้นหารหัส..."
              className="rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs"
            />
          </div>
        </div>

        {loadingRows && (
          <p className="mb-2 text-xs text-admin-textMuted">กำลังโหลด...</p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-[11px] text-admin-textMuted">
              <tr>
                <th className="pb-2">รหัส</th>
                <th className="pb-2">สถานะ</th>
                <th className="pb-2">ล็อต</th>
                <th className="pb-2">หมดอายุ</th>
                <th className="pb-2">หมายเหตุ</th>
                <th className="pb-2 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const expired = today && r.expiresYMD && r.expiresYMD < today;
                return (
                  <tr key={r._id} className="border-t border-admin-border/60">
                    <td className="py-1.5 font-mono text-xs">{r.code}</td>
                    <td className="py-1.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          STATUS_STYLES[r.status] || ""
                        }`}
                      >
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                    <td className="py-1.5 text-xs">{r.importBatch || "—"}</td>
                    <td className="py-1.5 text-xs">
                      <span className={expired ? "text-red-600" : ""}>
                        {r.expiresYMD || "—"}
                        {expired ? " (หมดอายุ)" : ""}
                      </span>
                    </td>
                    <td className="py-1.5 text-xs text-admin-textMuted">
                      {r.voidReason || r.note || "—"}
                    </td>
                    <td className="py-1.5">
                      <div className="flex flex-wrap justify-end gap-1">
                        {r.status === "available" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleVoid(r)}
                              className="rounded-full px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                            >
                              ยกเลิก
                            </button>
                            {!r.assignedAt && (
                              <button
                                type="button"
                                onClick={() => handleDelete(r)}
                                className="rounded-full px-2 py-1 text-[11px] text-admin-textMuted hover:bg-admin-surfaceMuted"
                              >
                                ลบ
                              </button>
                            )}
                          </>
                        )}
                        {r.status === "void" && (
                          <button
                            type="button"
                            onClick={() =>
                              patchCode(
                                r._id,
                                { action: "unvoid" },
                                `นำรหัส ${r.code} กลับเข้าคลัง?`,
                              )
                            }
                            className="rounded-full px-2 py-1 text-[11px] text-brand-primary hover:bg-brand-primary/10"
                          >
                            นำกลับเข้าคลัง
                          </button>
                        )}
                        {r.status === "awaiting_return" && (
                          <button
                            type="button"
                            onClick={() =>
                              patchCode(
                                r._id,
                                { action: "confirmReturn" },
                                `ยืนยันว่าได้รับคูปอง ${r.code} คืนแล้ว?`,
                              )
                            }
                            className="rounded-full px-2 py-1 text-[11px] text-brand-primary hover:bg-brand-primary/10"
                          >
                            ยืนยันรับคืน
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const note = prompt("หมายเหตุ:", r.note || "");
                            if (note === null) return;
                            patchCode(r._id, { action: "note", note });
                          }}
                          className="rounded-full px-2 py-1 text-[11px] text-admin-textMuted hover:bg-admin-surfaceMuted"
                        >
                          หมายเหตุ
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loadingRows && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-xs text-admin-textMuted">
                    ไม่พบคูปองตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-xs">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-admin-border px-3 py-1 disabled:opacity-40"
            >
              ← ก่อนหน้า
            </button>
            <span className="text-admin-textMuted">
              หน้า {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-admin-border px-3 py-1 disabled:opacity-40"
            >
              ถัดไป →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
