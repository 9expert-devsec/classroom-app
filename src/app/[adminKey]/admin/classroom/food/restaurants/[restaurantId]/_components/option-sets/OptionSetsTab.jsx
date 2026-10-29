"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import OptionSetCard from "./OptionSetCard";

function Toolbar({ params, setParams, searchResetKey, usage, setUsage }) {
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-[2_1_320px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-textMuted" />
        <input
          key={searchResetKey}
          defaultValue={params.q}
          onChange={(e) => {
            const v = e.target.value;
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setParams({ q: v.trim() }), 300);
          }}
          placeholder="ค้นหาชุดตัวเลือก…"
          aria-label="ค้นหาชุดตัวเลือก"
          className="w-full rounded-xl border border-admin-border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        />
      </div>
      <label className="flex min-w-0 flex-[1_1_200px] items-center gap-2 rounded-xl border border-admin-border bg-white pl-3">
        <span className="flex-shrink-0 text-xs text-admin-textMuted">การใช้งาน:</span>
        <select
          value={usage}
          onChange={(e) => setUsage(e.target.value)}
          className="min-w-0 flex-1 cursor-pointer rounded-xl bg-transparent py-2 pr-2 text-sm outline-none"
        >
          <option value="">ทั้งหมด</option>
          <option value="used">ใช้อยู่</option>
          <option value="unused">ยังไม่ได้ใช้</option>
        </select>
      </label>
    </div>
  );
}

export default function OptionSetsTab({
  optionSets,
  loading,
  params,
  setParams,
  highlightId,
  onNew,
  onEdit,
  onAttach,
  onDelete,
}) {
  const [searchResetKey, setSearchResetKey] = useState(0);
  // usage filter is local (not in the URL): it is only a view of the loaded list
  const [usage, setUsage] = useState("");

  const rows = useMemo(() => {
    const kw = params.q.toLowerCase();
    return optionSets.filter((s) => {
      if (kw && !String(s.name || "").toLowerCase().includes(kw)) return false;
      if (usage === "used") return (s.menuCount || 0) > 0;
      if (usage === "unused") return !s.menuCount;
      return true;
    });
  }, [optionSets, params.q, usage]);

  const handlers = { onEdit, onAttach, onDelete };

  return (
    <div className="space-y-4">
      <Toolbar
        params={params}
        setParams={setParams}
        searchResetKey={searchResetKey}
        usage={usage}
        setUsage={setUsage}
      />
      <p className="text-xs text-admin-textMuted">
        ชุดตัวเลือกสร้างครั้งเดียว ผูกได้หลายเมนู แก้ที่ชุดแล้วเมนูที่ผูกไว้อัปเดตตาม (ยกเว้นราคาที่ปรับเฉพาะเมนู)
      </p>

      {loading && optionSets.length === 0 ? (
        <p className="py-10 text-center text-sm text-admin-textMuted">กำลังโหลด...</p>
      ) : optionSets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-admin-border bg-white py-12">
          <div className="text-sm text-admin-textMuted">
            ยังไม่มีชุดตัวเลือก สร้างชุดครั้งเดียวแล้วนำไปใช้กับหลายเมนูได้
          </div>
          <button
            type="button"
            onClick={onNew}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primaryDark px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            <Plus className="h-4 w-4" /> สร้างชุดตัวเลือก
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="space-y-2 rounded-2xl border border-dashed border-admin-border bg-white py-12 text-center text-sm text-admin-textMuted">
          <div>ไม่พบชุดตัวเลือกตามเงื่อนไข</div>
          <button
            type="button"
            onClick={() => {
              setParams({ q: "" });
              setUsage("");
              setSearchResetKey((k) => k + 1);
            }}
            className="text-xs text-brand-primaryDark hover:underline"
          >
            ล้างตัวกรอง
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((s) => (
            <OptionSetCard
              key={String(s._id)}
              set={s}
              highlight={highlightId === String(s._id)}
              {...handlers}
            />
          ))}
        </div>
      )}
    </div>
  );
}
