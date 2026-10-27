"use client";

import { Filter, Search } from "lucide-react";

import { COUPON_FILTER_STATUSES, FILTER_TYPES } from "./reportUi";

const SELECT =
  "mt-1 h-10 w-full rounded-xl border border-admin-border bg-white px-3 text-sm text-admin-text focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:cursor-not-allowed disabled:bg-admin-surfaceMuted disabled:text-admin-textMuted";

/**
 * detail-table filters: class / type / coupon status / มีข้อสังเกต / search — URL params;
 * the date range is the page's own filter
 * R6-1: ประเภท = ทั้งหมด · Set · คูปอง · ไม่รับอาหาร · สถานะคูปองใช้ได้เมื่อประเภท = ทั้งหมด / คูปอง
 *       "มีข้อสังเกต" แยกเป็น checkbox (?flagged=1) — ใช้ร่วมกับตัวกรองอื่นได้
 */
export default function ReportFilters({ params, setParams, classOptions }) {
  const active = params.cls || params.type || params.status || params.flagged || params.q;
  const statusEnabled = params.type === "" || params.type === "coupon";
  return (
    // R6-1: flex-wrap + ความกว้างขั้นต่ำ — ช่องไม่ถูกบีบจนอ่านไม่ออก (จอแคบ / เมนูข้างขยาย) แต่ขึ้นบรรทัดใหม่แทน
    <div className="flex flex-wrap items-end gap-3">
      <label className="block min-w-[180px] flex-1 text-[11px] text-admin-textMuted">
        Class
        <select className={SELECT} value={params.cls} onChange={(e) => setParams({ class: e.target.value })}>
          <option value="">ทุก Class</option>
          {classOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block min-w-[140px] flex-1 text-[11px] text-admin-textMuted">
        ประเภท
        <select
          className={SELECT}
          value={params.type}
          onChange={(e) => {
            const type = e.target.value;
            // สถานะคูปองไม่มีความหมายกับ Set / ไม่รับอาหาร -> ล้างทิ้ง (เขียนค่าที่แปลงแล้วทับค่าเดิมใน URL)
            setParams({ type, status: type === "" || type === "coupon" ? params.status : "" });
          }}
        >
          <option value="">ทั้งหมด</option>
          {Object.entries(FILTER_TYPES).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="block min-w-[140px] flex-1 text-[11px] text-admin-textMuted">
        สถานะคูปอง
        <select
          className={SELECT}
          value={params.status}
          disabled={!statusEnabled}
          title={statusEnabled ? undefined : "ใช้ได้เมื่อประเภทเป็น ทั้งหมด หรือ คูปอง"}
          onChange={(e) => setParams({ status: e.target.value, type: params.type })}
        >
          <option value="">ทั้งหมด</option>
          {Object.entries(COUPON_FILTER_STATUSES).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-admin-border bg-white px-3 text-sm text-admin-text">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={params.flagged}
          // ?status=flagged (URL เดิม) ถูกแทนด้วย ?flagged=1
          onChange={(e) => setParams({ flagged: e.target.checked ? 1 : "", status: params.status })}
        />
        มีข้อสังเกต
      </label>

      <label className="relative block min-w-[220px] flex-[2] text-[11px] text-admin-textMuted">
        <span className="sr-only">ค้นหา</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-textMuted" />
        <input
          className="h-10 w-full rounded-xl border border-admin-border bg-white pl-9 pr-3 text-sm text-admin-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
          placeholder="ค้นหาชื่อผู้เรียน, ร้าน, เมนู, รหัสคูปอง..."
          value={params.q}
          onChange={(e) => setParams({ q: e.target.value })}
        />
      </label>

      <button
        type="button"
        disabled={!active}
        onClick={() => setParams({ class: "", type: "", status: "", flagged: "", q: "" })}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-brand-primary/30 px-4 text-sm font-semibold text-brand-primary hover:bg-brand-primary/10 disabled:opacity-40"
      >
        <Filter className="h-4 w-4" />
        ล้างตัวกรอง
      </button>
    </div>
  );
}
