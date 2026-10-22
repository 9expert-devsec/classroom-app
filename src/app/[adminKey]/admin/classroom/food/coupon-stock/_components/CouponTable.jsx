"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Filter,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatImportedAt,
  isExpiryUrgent,
  lotKey,
  lotLabel,
  parseLotKey,
  safeJson,
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_STYLES,
} from "./stockUi";
import { sortLots } from "./LotCards";

const PAGE_SIZES = [10, 20, 50];

const EXPIRY_LABELS = {
  "": "ทั้งหมด",
  soon: "ใกล้หมดอายุ (≤ 7 วัน)",
  expired: "หมดอายุแล้ว",
};

// 1 … 4 5 6 … 12
function pageList(page, totalPages) {
  const set = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = [...set].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

function Chip({ children, onClear }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/15 px-2.5 py-1 text-xs text-admin-text">
      {children}
      <button
        type="button"
        onClick={onClear}
        aria-label="ล้างตัวกรอง"
        className="rounded-full p-0.5 hover:bg-brand-primary/25"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export default function CouponTable({
  restaurantId,
  summary,
  activeLot,
  onLotChange,
  reloadKey,
  onChanged,
}) {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [expiry, setExpiry] = useState("");
  const [sort, setSort] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const loadSeq = useRef(0);

  const today = summary?.today || "";
  const lot = parseLotKey(activeLot);

  // debounce search typing
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  // any filter change goes back to page 1
  useEffect(() => {
    setPage(1);
  }, [q, status, expiry, sort, pageSize, activeLot]);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    // a filter change also resets the page -> drop the older response
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        restaurantId,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (status) qs.set("status", status);
      if (expiry) qs.set("expiry", expiry);
      if (sort) qs.set("sort", sort);
      if (q) qs.set("q", q);
      if (lot) {
        qs.set("batch", lot.batch);
        if (lot.expiresYMD) qs.set("expiresYMD", lot.expiresYMD);
      }

      const res = await fetch(`/api/admin/food/coupon-stock?${qs.toString()}`, {
        cache: "no-store",
      });
      const data = await safeJson(res);
      if (seq !== loadSeq.current) return;
      if (!res.ok) {
        console.error(data);
        toast.error(data.error || "โหลดรายการคูปองไม่สำเร็จ");
        return;
      }
      setRows(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
      if (seq === loadSeq.current) toast.error("โหลดรายการคูปองไม่สำเร็จ");
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
    // lot is derived from activeLot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, page, pageSize, status, expiry, sort, q, activeLot]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  /* ---------- tab counts: whole shop, or the selected lot ---------- */
  const tabCounts = useMemo(() => {
    const by = summary?.byStatus || {};
    if (lot) {
      const b = (summary?.batches || []).find(
        (x) => lotKey(x.importBatch, x.expiresYMD) === activeLot,
      );
      if (b) {
        return {
          "": b.total,
          available: b.available,
          assigned: b.assigned,
          handed_out: b.handedOut,
          awaiting_return: b.awaitingReturn,
          void: b.voided,
        };
      }
    }
    const all = Object.values(by).reduce((a, n) => a + (Number(n) || 0), 0);
    return { "": all, ...by };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, activeLot]);

  const shopIsEmpty = (summary?.batches || []).length === 0;
  const hasFilters = !!(q || status || expiry || activeLot);
  const lots = sortLots(summary?.batches);

  function clearFilters() {
    setQInput("");
    setQ("");
    setStatus("");
    setExpiry("");
    onLotChange("");
  }

  /* ---------- row actions (existing API only) ---------- */
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
        toast.error(data.error || "ทำรายการไม่สำเร็จ");
        return;
      }
      onChanged();
    } catch (err) {
      console.error(err);
      toast.error("ทำรายการไม่สำเร็จ");
    }
  }

  function handleVoid(row) {
    const reason = prompt(`เหตุผลที่ยกเลิกรหัส ${row.code}:`, "");
    if (reason === null) return;
    if (!reason.trim()) return toast.error("กรุณาระบุเหตุผล");
    patchCode(row._id, { action: "void", reason });
  }

  function handleNote(row) {
    const note = prompt("หมายเหตุ:", row.note || "");
    if (note === null) return;
    patchCode(row._id, { action: "note", note });
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
        toast.error(data.error || "ลบไม่สำเร็จ");
        return;
      }
      onChanged();
    } catch (err) {
      console.error(err);
      toast.error("ลบไม่สำเร็จ");
    }
  }

  function toggleSort() {
    setSort((s) => (s === "expires_asc" ? "expires_desc" : s === "expires_desc" ? "" : "expires_asc"));
  }

  const activeFilterCount = (activeLot ? 1 : 0) + (expiry ? 1 : 0);

  return (
    <div className="min-w-0 rounded-2xl bg-admin-surface p-4 shadow-sm">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">รายการคูปอง ({total})</h2>
          <p className="text-xs text-admin-textMuted">รายการคูปองอาหารทั้งหมดในระบบ</p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-textMuted" />
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="ค้นหารหัสคูปอง, ชื่อล็อต, หมายเหตุ..."
              className="w-full rounded-xl border border-admin-border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-admin-border bg-white px-3 py-2 text-sm hover:bg-admin-surfaceMuted"
              >
                <Filter className="h-4 w-4" />
                ตัวกรอง
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-brand-primary px-1.5 text-[11px] font-semibold text-[#0D1B2A]">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3 rounded-xl text-sm">
              <label className="block">
                <span className="text-xs text-admin-textMuted">ล็อต</span>
                <select
                  value={activeLot}
                  onChange={(e) => onLotChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-admin-border bg-white p-2 text-sm"
                >
                  <option value="">ทุกล็อต</option>
                  {lots.map((b) => {
                    const key = lotKey(b.importBatch, b.expiresYMD);
                    return (
                      <option key={key} value={key}>
                        {lotLabel(b.importBatch)} · {b.expiresYMD || "—"}
                        {b.lotStatus === "cancelled" ? " (ยกเลิกแล้ว)" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-admin-textMuted">วันหมดอายุ</span>
                <select
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-admin-border bg-white p-2 text-sm"
                >
                  {Object.entries(EXPIRY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setExpiry("");
                    onLotChange("");
                  }}
                  className="text-xs text-brand-primaryDark hover:underline"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* active filter chips */}
      {activeFilterCount > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {lot && (
            <Chip onClear={() => onLotChange("")}>
              ล็อต: {lot.batch === "__none__" ? "ไม่ระบุล็อต" : lot.batch}
              {lot.expiresYMD ? ` · ${lot.expiresYMD}` : ""}
            </Chip>
          )}
          {expiry && (
            <Chip onClear={() => setExpiry("")}>หมดอายุ: {EXPIRY_LABELS[expiry]}</Chip>
          )}
        </div>
      )}

      {/* status tabs */}
      <div className="mt-3 flex gap-1 overflow-x-auto border-b border-admin-border">
        {["", ...STATUS_ORDER].map((s) => {
          const active = status === s;
          return (
            <button
              key={s || "all"}
              type="button"
              onClick={() => setStatus(s)}
              className={[
                "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition",
                active
                  ? "border-brand-primaryDark font-semibold text-brand-primaryDark"
                  : "border-transparent text-admin-textMuted hover:text-admin-text",
              ].join(" ")}
            >
              {s ? STATUS_LABELS[s] : "ทั้งหมด"} ({tabCounts[s] ?? 0})
            </button>
          );
        })}
      </div>

      {/* table */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-admin-surfaceMuted text-left text-xs text-admin-textMuted">
            <tr>
              <th className="px-3 py-2 font-medium">รหัสคูปอง</th>
              <th className="px-3 py-2 font-medium">สถานะ</th>
              <th className="px-3 py-2 font-medium">ชื่อล็อต</th>
              <th className="px-3 py-2 font-medium">
                <button
                  type="button"
                  onClick={toggleSort}
                  className="inline-flex items-center gap-1 hover:text-admin-text"
                  title="เรียงตามวันหมดอายุ"
                >
                  หมดอายุ
                  {sort === "expires_asc" && <ArrowUp className="h-3 w-3" />}
                  {sort === "expires_desc" && <ArrowDown className="h-3 w-3" />}
                </button>
              </th>
              <th className="px-3 py-2 font-medium">หมายเหตุ</th>
              <th className="px-3 py-2 font-medium">วันที่นำเข้า</th>
              <th className="px-3 py-2 text-right font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody className={loading ? "opacity-60" : ""}>
            {rows.map((r) => {
              const urgent = isExpiryUrgent(today, r.expiresYMD);
              const canDelete = r.status === "available" && !r.assignedAt;
              return (
                <tr key={r._id} className="border-t border-admin-border/60 hover:bg-admin-surfaceMuted/60">
                  <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        STATUS_STYLES[r.status] || ""
                      }`}
                    >
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">{r.importBatch || "—"}</td>
                  <td className={`px-3 py-2 text-xs ${urgent ? "font-medium text-red-600" : ""}`}>
                    {r.expiresYMD || "—"}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-xs text-admin-textMuted" title={r.voidReason || r.note || ""}>
                    {r.voidReason || r.note || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">{formatImportedAt(r.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="เมนูการจัดการ"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-admin-surfaceMuted"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        sideOffset={6}
                        className="w-40 rounded-xl bg-white py-1 text-xs shadow-lg ring-1 ring-black/5"
                      >
                        {r.status === "awaiting_return" && (
                          <DropdownMenuItem
                            onSelect={() =>
                              patchCode(
                                r._id,
                                { action: "confirmReturn" },
                                `ยืนยันว่าได้รับคูปอง ${r.code} คืนแล้ว?`,
                              )
                            }
                          >
                            ยืนยันรับคืน
                          </DropdownMenuItem>
                        )}
                        {r.status === "void" &&
                          (r.lotStatus === "cancelled" ? (
                            // R5-3: ล็อตถูกยกเลิก -> คืนทีละใบไม่ได้ (server ตอบ 409 อยู่แล้ว)
                            <DropdownMenuItem
                              disabled
                              title="ล็อตนี้ถูกยกเลิก — กู้คืนล็อตก่อน"
                              className="flex-col items-start"
                            >
                              นำกลับเข้าคลัง
                              <span className="text-[11px] text-admin-textMuted">
                                ล็อตนี้ถูกยกเลิก — กู้คืนล็อตก่อน
                              </span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={() =>
                                patchCode(
                                  r._id,
                                  { action: "unvoid" },
                                  `นำรหัส ${r.code} กลับเข้าคลัง?`,
                                )
                              }
                            >
                              นำกลับเข้าคลัง
                            </DropdownMenuItem>
                          ))}
                        <DropdownMenuItem onSelect={() => handleNote(r)}>
                          แก้หมายเหตุ
                        </DropdownMenuItem>
                        {r.status === "available" && (
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onSelect={() => handleVoid(r)}
                          >
                            ยกเลิก (void)
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onSelect={() => handleDelete(r)}
                          >
                            ลบถาวร
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center">
                  {shopIsEmpty && !hasFilters ? (
                    <div className="text-sm text-admin-textMuted">
                      ร้านนี้ยังไม่มีคูปองในคลัง — กด &quot;+ นำเข้าคูปอง&quot; เพื่อเริ่มต้น
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm text-admin-textMuted">
                      <div>ไม่พบคูปองตามคำค้นหาหรือตัวกรองที่เลือก</div>
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="text-xs text-brand-primaryDark hover:underline"
                      >
                        ล้างคำค้นหาและตัวกรอง
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <label className="flex items-center gap-2 text-admin-textMuted">
          แสดง
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-lg border border-admin-border bg-white px-2 py-1 text-xs text-admin-text"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          รายการต่อหน้า
        </label>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="หน้าก่อนหน้า"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-admin-border disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageList(page, totalPages).map((p) =>
              typeof p === "string" ? (
                <span key={p} className="px-1 text-admin-textMuted">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={[
                    "h-8 min-w-8 rounded-lg px-2",
                    p === page
                      ? "bg-brand-primary font-semibold text-[#0D1B2A]"
                      : "border border-admin-border hover:bg-admin-surfaceMuted",
                  ].join(" ")}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="หน้าถัดไป"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-admin-border disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
