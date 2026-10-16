// src/app/[adminKey]/admin/classroom/food/report/FoodReportClient.jsx
"use client";

// Food Report — layout only. Rows come from /api/admin/food-orders (resolveFoodDay per day);
// statuses, counting rules, the 15:00 rules, admin edit and the print templates are unchanged.
import { useEffect, useMemo, useState } from "react";

import { DateRangeBar, ReportHeader } from "./_components/ReportHeader";
import { ReportTabs } from "./_components/ReportBits";
import KpiCards from "./_components/KpiCards";
import ShopSummary from "./_components/ShopSummary";
import TopMenus from "./_components/TopMenus";
import ReportFilters from "./_components/ReportFilters";
import ReportTable from "./_components/ReportTable";
import ClassGroupedTable, { groupRowsByClass } from "./_components/ClassGroupedTable";
import ReportPagination from "./_components/ReportPagination";
import SelectionBar from "./_components/SelectionBar";
import GroupSections from "./_components/GroupSections";
import EditFoodModal from "./_components/EditFoodModal";
import OrderSheetModal from "./_components/OrderSheetModal";
import SetSheetModal from "./_components/SetSheetModal";
import { buildSetSheetHtml } from "./setSheetHtml";
import { buildClassPrintHtml } from "./_components/classPrintHtml";
import {
  NO_SHOP_KEY,
  NO_SHOP_LABEL,
  TYPE_META,
  aoaToCsv,
  buildExportAoa,
  cleanClassTitle,
  countRows,
  downloadBlob,
  matchesSearch,
  rangeLabel,
  rowId,
  rowType,
  setMenuLabel,
  shopOf,
  statusKeyOf,
  typeKeyOf,
  useReportParams,
} from "./_components/reportUi";

const TYPE_ORDER = Object.keys(TYPE_META);
const SHOP_SECTION_ID = "shop-section-";

// เปิดหน้าต่างพิมพ์ (ใช้ร่วมกันทั้ง per-class print และใบสั่งร้าน)
function openAndPrint(html) {
  const w = window.open("", "_blank");
  if (!w) return false;

  w.document.open();
  w.document.write(html);
  w.document.close();

  const doPrint = () => {
    try {
      w.focus();
      w.print();
    } catch (e) {
      console.error(e);
    }
  };

  w.onload = () => setTimeout(doPrint, 80);
  setTimeout(doPrint, 500);
  return true;
}

function groupBy(rows, keyOf) {
  const map = new Map();
  rows.forEach((o) => {
    const k = keyOf(o);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(o);
  });
  return map;
}

function typesOf(rows) {
  const s = new Set(rows.map(typeKeyOf));
  return TYPE_ORDER.filter((t) => s.has(t));
}

export default function FoodReportClient({ todayYMD }) {
  const [params, setParams] = useReportParams(todayYMD);
  const { from, to } = params;

  const [reloadTick, setReloadTick] = useState(0);
  const loadKey = `${from}:${to}:${reloadTick}`;
  const [data, setData] = useState({ key: "", rows: [], days: [], error: "" });
  const loading = data.key !== loadKey;

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [editingRow, setEditingRow] = useState(null);
  const [sheet, setSheet] = useState(null); // { day, shopId }
  const [setSheetShop, setSetSheet] = useState(null); // shop group (set shop) picking a day

  useEffect(() => {
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ from, to });
    fetch(`/api/admin/food-orders?${qs.toString()}`, { cache: "no-store", signal: ctrl.signal })
      .then((res) => res.json())
      .then((out) => {
        if (!out?.ok) throw new Error(out?.error || "load failed");
        setData({ key: loadKey, rows: out.rows || [], days: out.days || [], error: "" });
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        console.error(err);
        setData({ key: loadKey, rows: [], days: [], error: "โหลดข้อมูล Food Report ไม่สำเร็จ" });
      });
    return () => ctrl.abort();
  }, [from, to, loadKey]);

  const reload = () => setReloadTick((n) => n + 1);

  // shop picked in สรุปตามร้านค้า → ตามร้านค้า opens and scrolls to its section (UI focus, not a filter)
  const [focusShop, setFocusShop] = useState("");
  useEffect(() => {
    if (params.tab !== "shops" || !focusShop) return;
    document
      .getElementById(`${SHOP_SECTION_ID}${focusShop}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [params.tab, focusShop]);

  /* ---------------- derived ---------------- */
  // day → class → server order (stable)
  const allRows = useMemo(() => {
    const withTitle = data.rows.map((o, i) => ({
      o,
      i,
      cls: cleanClassTitle(o.className || o.classTitle || "-", o.courseCode),
    }));
    withTitle.sort(
      (a, b) =>
        String(a.o.dayYMD).localeCompare(String(b.o.dayYMD)) ||
        a.cls.localeCompare(b.cls, "th") ||
        a.i - b.i,
    );
    return withTitle.map((x) => x.o);
  }, [data.rows]);

  // the date range is the only page-level filter: KPIs, summaries, every tab, export and print use allRows
  const counts = useMemo(() => countRows(allRows), [allRows]);

  // stock extras from the per-day server summary (awaiting return / missing code)
  const stockExtras = useMemo(() => {
    const map = new Map();
    data.days.forEach((d) =>
      (d.shops || []).forEach((s) => {
        if (s.source !== "stock") return;
        const x = map.get(s.id) || { awaitingReturn: 0, missingCode: 0 };
        x.awaitingReturn += s.awaitingReturn || 0;
        x.missingCode += s.missingCode || 0;
        map.set(s.id, x);
      }),
    );
    return map;
  }, [data.days]);

  const shopGroups = useMemo(() => {
    const groups = [...groupBy(allRows, (o) => shopOf(o)?.key || NO_SHOP_KEY).entries()].map(
      ([key, rows]) => {
        const x = stockExtras.get(key);
        const extras = x
          ? [
              x.awaitingReturn ? `รอคืนคูปอง ${x.awaitingReturn}` : "",
              x.missingCode ? `ไม่มีโค้ด ${x.missingCode}` : "",
            ]
              .filter(Boolean)
              .join(" · ")
          : "";
        return {
          key,
          name: key === NO_SHOP_KEY ? NO_SHOP_LABEL : shopOf(rows[0])?.name || "-",
          types: typesOf(rows),
          counts: countRows(rows),
          rows,
          extras,
        };
      },
    );
    return groups.sort(
      (a, b) =>
        (a.key === NO_SHOP_KEY) - (b.key === NO_SHOP_KEY) || a.name.localeCompare(b.name, "th"),
    );
  }, [allRows, stockExtras]);

  const typeGroups = useMemo(() => {
    const map = groupBy(allRows, typeKeyOf);
    return TYPE_ORDER.filter((t) => map.has(t)).map((t) => ({
      key: t,
      title: TYPE_META[t].hint ? `${TYPE_META[t].label} — ${TYPE_META[t].hint}` : TYPE_META[t].label,
      types: [],
      counts: countRows(map.get(t)),
      rows: map.get(t),
    }));
  }, [allRows]);

  const topMenus = useMemo(() => {
    const counter = new Map();
    allRows.forEach((o) => {
      if (rowType(o) !== "set") return;
      const label = setMenuLabel(o);
      counter.set(label, (counter.get(label) || 0) + 1);
    });
    return [...counter.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "th"));
  }, [allRows]);

  const classOptions = useMemo(() => {
    const map = new Map();
    allRows.forEach((o) => {
      const id = o.classId || o.className || "unknown";
      if (!map.has(id)) {
        map.set(id, { id, name: cleanClassTitle(o.className || o.classTitle || "-", o.courseCode) });
      }
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [allRows]);

  // table filters
  const listRows = useMemo(
    () =>
      allRows.filter((o) => {
        if (params.cls && (o.classId || o.className || "unknown") !== params.cls) return false;
        if (params.type && typeKeyOf(o) !== params.type) return false;
        if (params.status === "flagged") {
          if (!(o.flags || []).length) return false;
        } else if (params.status && statusKeyOf(o) !== params.status) return false;
        return matchesSearch(o, params.q);
      }),
    [allRows, params.cls, params.type, params.status, params.q],
  );

  const totalPages = Math.max(1, Math.ceil(listRows.length / params.size));
  const page = Math.min(params.page, totalPages);
  const pageStart = (page - 1) * params.size;
  const pageRows = listRows.slice(pageStart, pageStart + params.size);

  // r2d: "รายละเอียดรายการ" แยกการ์ดตาม Class — จัดกลุ่มหลังกรอง, เรียงตาม Class เฉพาะตอนแสดง
  // (listRows เองไม่เปลี่ยนลำดับ -> export / พิมพ์ ยังได้ลำดับเดิม)
  const classGroups = useMemo(() => groupRowsByClass(listRows), [listRows]);
  const classOrderedRows = useMemo(() => classGroups.flatMap((g) => g.rows), [classGroups]);

  const selectedRows = useMemo(
    () => allRows.filter((o) => selectedIds.has(rowId(o))),
    [allRows, selectedIds],
  );

  const pastDayNote = data.days.some((d) => d.pastDayNote);
  const rowsByDay = useMemo(() => groupBy(allRows, (o) => o.dayYMD), [allRows]);
  const sheetDays = useMemo(
    () => data.days.filter((d) => (d.shops || []).length > 0),
    [data.days],
  );

  /* ---------------- selection ---------------- */
  function toggleRow(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleMany(ids, on) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  /* ---------------- export / print ---------------- */
  const fileStem = from === to ? from : `${from}_${to}`;

  function exportCsv(rows, selected) {
    if (!rows.length) return alert(selected ? "ยังไม่ได้เลือกรายชื่อ" : "ยังไม่มีข้อมูลสำหรับ Export");
    const csv = aoaToCsv(buildExportAoa(rows));
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `food-report_${selected ? "selected_" : ""}${fileStem}.csv`,
    );
  }

  async function exportXlsx(rows) {
    if (!rows.length) return alert("ยังไม่มีข้อมูลสำหรับ Export");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildExportAoa(rows)), "Food Report");
      XLSX.writeFile(wb, `food-report_${fileStem}.xlsx`);
    } catch (err) {
      console.error(err);
      alert("Export Excel ไม่สำเร็จ");
    }
  }

  function printRows(rows) {
    if (!rows.length) return;
    openAndPrint(buildClassPrintHtml(rows, rangeLabel(from, to)));
  }

  // ใบสั่งร้าน Set: rows of that shop section (set only), one day per sheet
  function setSheetDaysOf(group) {
    const byDay = groupBy(
      group.rows.filter((o) => rowType(o) === "set"),
      (o) => o.dayYMD,
    );
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dayYMD, rows]) => ({ dayYMD, rows, count: rows.length }));
  }

  function printSetSheet(group, dayYMD) {
    const day = setSheetDaysOf(group).find((d) => d.dayYMD === dayYMD);
    if (!day) return;
    const html = buildSetSheetHtml({
      rows: day.rows,
      shopName: group.name,
      dateYMD: dayYMD,
      printedAt: new Date(),
      origin: window.location.origin,
      classTitle: (o) => cleanClassTitle(o.className || o.classTitle || "-", o.courseCode),
    });
    if (!openAndPrint(html)) return alert("เปิดหน้าต่างพิมพ์ไม่ได้ (ตรวจสอบ pop-up blocker)");
    setSetSheet(null);
  }

  function openSetSheet(group) {
    const sheetDaysOfShop = setSheetDaysOf(group);
    if (sheetDaysOfShop.length === 1) printSetSheet(group, sheetDaysOfShop[0].dayYMD);
    else if (sheetDaysOfShop.length > 1) setSetSheet(group);
  }

  function openOrderSheet(shopId = "all") {
    if (!sheetDays.length) return alert("ช่วงวันที่นี้ยังไม่มีออร์เดอร์คูปองของร้านใด");
    const day =
      (shopId !== "all" && sheetDays.find((d) => d.shops.some((s) => s.id === shopId))?.dayYMD) ||
      sheetDays[0].dayYMD;
    setSheet({ day, shopId });
  }

  const printItems = [
    { label: "Print ทั้งหมด (ตาม filter)", onSelect: () => printRows(listRows), disabled: !listRows.length },
    { label: "พิมพ์ใบสั่งร้าน", onSelect: () => openOrderSheet("all") },
  ];
  const exportItems = [
    { label: "CSV (ตามตัวกรองปัจจุบัน)", onSelect: () => exportCsv(listRows, false) },
    { label: "Excel (.xlsx)", onSelect: () => exportXlsx(listRows) },
  ];

  const tableProps = {
    selectedIds,
    onToggle: toggleRow,
    onToggleMany: toggleMany,
    onEdit: setEditingRow,
  };

  const filtersActive = params.cls || params.type || params.status || params.q;
  const listEmpty = !allRows.length
    ? "ไม่มีข้อมูลในช่วงวันที่ที่เลือก"
    : filtersActive
      ? "ไม่พบรายการที่ตรงกับตัวกรอง"
      : "ไม่มีรายการ";

  const detailCard = (overview) => (
    <section className="min-w-0 space-y-3 rounded-2xl border border-admin-border bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-admin-text">รายละเอียดรายการ</h2>
        {overview && listRows.length > pageRows.length && (
          <button
            type="button"
            onClick={() => setParams({ tab: "list" })}
            className="text-xs font-semibold text-brand-primary hover:underline"
          >
            ดูทั้งหมด →
          </button>
        )}
      </div>
      <ReportFilters params={params} setParams={setParams} classOptions={classOptions} />
      {(() => {
        // แถวของหน้านี้ = ช่วงเดียวกับเดิม แต่ตัดจากลำดับตาม Class แล้วแบ่งเป็นการ์ด
        const shown = overview
          ? classOrderedRows.slice(0, params.size)
          : classOrderedRows.slice(pageStart, pageStart + params.size);
        if (!shown.length) return <ReportTable rows={[]} empty={listEmpty} {...tableProps} />;
        const shownIdList = shown.map(rowId);
        const allOn = shownIdList.every((id) => selectedIds.has(id));
        const someOn = !allOn && shownIdList.some((id) => selectedIds.has(id));
        return (
          <>
            {/* เลือกทั้งหมดในหน้านี้ (เดิมอยู่หัวตาราง) — หัวการ์ดแต่ละใบเลือกเฉพาะ Class นั้น */}
            <label className="flex w-fit items-center gap-2 px-1 text-xs text-admin-textMuted">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={allOn}
                ref={(el) => {
                  if (el) el.indeterminate = someOn;
                }}
                onChange={() => toggleMany(shownIdList, !allOn)}
              />
              เลือกทั้งหมดในหน้านี้ ({shown.length})
            </label>
            <ClassGroupedTable
              groups={classGroups}
              shownIds={new Set(shownIdList)}
              tableProps={tableProps}
            />
          </>
        );
      })()}
      {overview ? (
        <div className="text-xs text-admin-textMuted">จากทั้งหมด {listRows.length} รายการ</div>
      ) : (
        <ReportPagination
          page={page}
          totalPages={totalPages}
          size={params.size}
          total={listRows.length}
          onPage={(p) => setParams({ page: p })}
          onSize={(n) => setParams({ size: n })}
        />
      )}
    </section>
  );

  /* ---------------- render ---------------- */
  return (
    // layout แม่ (<main>) เป็น overflow-hidden — หน้านี้ scroll เอง
    <div className="flex h-full min-w-0 flex-col gap-4 overflow-y-auto overflow-x-hidden overscroll-contain pr-1">
      <ReportHeader printItems={printItems} exportItems={exportItems} />

      <div className="shrink-0">
        <ReportTabs
          tab={params.tab}
          onTab={(tab) => {
            setFocusShop("");
            setParams({ tab });
          }}
        />
      </div>

      <DateRangeBar
        from={from}
        to={to}
        todayYMD={todayYMD}
        onChange={(f, t) => setParams({ from: f, to: t })}
      >
        {/* counts of the previous range are never shown while the new one loads */}
        {loading ? (
          <span>กำลังโหลดข้อมูล...</span>
        ) : data.error ? (
          <span className="text-red-600">{data.error}</span>
        ) : (
          <span>
            รวม <b className="text-admin-text">{counts.total}</b> รายการ · ไม่รับอาหาร{" "}
            <b className="text-admin-text">{counts.byType.none}</b>
          </span>
        )}
      </DateRangeBar>

      {pastDayNote && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          วันที่ผ่านมาแล้ว: ข้อมูลอาหาร Set / ไม่รับอาหาร แสดงตามที่เลือกไว้ล่าสุดของผู้เรียน
          (ระบบไม่ได้เก็บแยกรายวัน) — ส่วนคูปองมาจากออเดอร์ของวันนั้นจริง
        </div>
      )}

      <SelectionBar
        count={selectedRows.length}
        onClear={() => setSelectedIds(new Set())}
        onExport={() => exportCsv(selectedRows, true)}
        onPrint={() => {
          if (!selectedRows.length) return alert("ยังไม่ได้เลือกรายชื่อ");
          printRows(selectedRows);
        }}
      />

      {params.tab === "overview" && (
        <>
          <KpiCards counts={counts} />
          <ShopSummary
            shops={shopGroups}
            onPick={(shop) => {
              setFocusShop(shop);
              setParams({ tab: "shops" });
            }}
          />
          <TopMenus items={topMenus} />
          {detailCard(true)}
        </>
      )}

      {params.tab === "shops" && (
        <GroupSections
          empty="ไม่มีข้อมูลในช่วงวันที่ที่เลือก"
          tableProps={tableProps}
          idPrefix={SHOP_SECTION_ID}
          focusKey={focusShop}
          groups={shopGroups.map((g) => ({
            ...g,
            title: g.name,
            action: sheetDays.some((d) => d.shops.some((s) => s.id === g.key)) ? (
              <button
                type="button"
                onClick={() => openOrderSheet(g.key)}
                className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100"
              >
                พิมพ์ใบสั่งร้าน
              </button>
            ) : g.types.includes("set") ? (
              <button
                type="button"
                onClick={() => openSetSheet(g)}
                className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100"
              >
                พิมพ์ใบสั่งร้าน
              </button>
            ) : null,
          }))}
        />
      )}

      {params.tab === "types" && (
        <GroupSections
          empty="ไม่มีข้อมูลในช่วงวันที่ที่เลือก"
          tableProps={tableProps}
          groups={typeGroups}
        />
      )}

      {params.tab === "list" && detailCard(false)}

      {setSheetShop && (
        <SetSheetModal
          shopName={setSheetShop.name}
          days={setSheetDaysOf(setSheetShop)}
          onPrint={(dayYMD) => printSetSheet(setSheetShop, dayYMD)}
          onClose={() => setSetSheet(null)}
        />
      )}

      {sheet && (
        <OrderSheetModal
          days={sheetDays}
          rowsByDay={rowsByDay}
          initialDay={sheet.day}
          initialShopId={sheet.shopId}
          openAndPrint={openAndPrint}
          onClose={() => setSheet(null)}
        />
      )}

      {editingRow && (
        <EditFoodModal
          key={rowId(editingRow)}
          row={editingRow}
          onClose={() => setEditingRow(null)}
          onSaved={async () => {
            setEditingRow(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
