"use client";

import { Fragment, useSyncExternalStore } from "react";
import { CalendarDays, MoreHorizontal, Plus } from "lucide-react";
import PrimaryButton from "@/components/ui/PrimaryButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  daysLeft,
  EXPIRING_DAYS,
  isLotActive,
  isLotCancelled,
  loadLotView,
  LOT_VIEW_LABELS,
  LOT_VIEWS,
  lotKey,
  lotLabel,
  saveLotView,
} from "./stockUi";

// R5-3c: soonest expiry first, then name (the table filter and import drawer use the same order)
export function sortLots(batches) {
  return [...(batches || [])].sort((a, b) => {
    if (a.expiresYMD !== b.expiresYMD)
      return (a.expiresYMD || "9999").localeCompare(b.expiresYMD || "9999");
    return (a.importBatch || "").localeCompare(b.importBatch || "");
  });
}

// progress bar on a lot card = out of stock through an order
// (assigned + handed out + awaiting return); void is neither
export function lotUsed(b) {
  return (b.assigned || 0) + (b.handedOut || 0) + (b.awaitingReturn || 0);
}

// R5-3b: ใส่จุดตัดบรรทัด (<wbr>) หลัง - _ / . — ชื่ออย่าง "DEV-FIXTURE-P3F" จะไม่ขาดกลางคำ
function breakableName(name) {
  // "A-B.C" -> ["A-", "B.", "C"] (ไม่ใช้ lookbehind เพื่อรองรับ Safari รุ่นเก่า)
  const parts = String(name).match(/[^-_/.]*[-_/.]|[^-_/.]+$/g) || [String(name)];
  return parts.map((p, i) => (
    <Fragment key={i}>
      {p}
      {i < parts.length - 1 && <wbr />}
    </Fragment>
  ));
}

function lotPill(b, d) {
  if (isLotCancelled(b)) return { text: "ยกเลิกแล้ว", cls: "bg-slate-200 text-slate-600" };
  // R5-3c: ส่งมอบ / ยกเลิกรายใบหมดทุกใบ — ไม่เหลืออะไรให้ทำ
  if (!isLotActive(b)) return { text: "ใช้หมดแล้ว", cls: "bg-slate-100 text-slate-600" };
  if (!b.importBatch) return { text: "ไม่ระบุ", cls: "bg-slate-100 text-slate-600" };
  if (d !== null && d < 0) return { text: "หมดอายุ", cls: "bg-red-100 text-red-700" };
  if (d !== null && d <= EXPIRING_DAYS)
    return { text: "ใกล้หมดอายุ", cls: "bg-red-50 text-red-600" };
  return { text: "ปกติ", cls: "bg-green-100 text-green-700" };
}

// R5-3: เมนู ⋯ ของการ์ดล็อต — ล็อตปกติ: แก้ไข / ลบ-ยกเลิก · ล็อตที่ยกเลิกแล้ว: กู้คืน
function LotMenu({ b, onAction }) {
  const cancelled = isLotCancelled(b);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`เมนูล็อต ${lotLabel(b.importBatch)}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-admin-textMuted hover:bg-admin-surfaceMuted"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-44 rounded-xl bg-white py-1 text-xs shadow-lg ring-1 ring-black/5"
      >
        {cancelled ? (
          <DropdownMenuItem onSelect={() => onAction("restore", b)}>กู้คืนล็อต</DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onSelect={() => onAction("edit", b)}>แก้ไขล็อต</DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onSelect={() => onAction("remove", b)}
            >
              ลบ / ยกเลิกล็อต
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LotCard({ b, today, active, highlight, onClick, onAction }) {
  const cancelled = isLotCancelled(b);
  const d = daysLeft(today, b.expiresYMD);
  const pill = lotPill(b, d);
  const urgent = !cancelled && d !== null && d <= EXPIRING_DAYS;
  const used = lotUsed(b);
  const pct = b.total > 0 ? Math.round((used / b.total) * 100) : 0;

  // R5-3b: การ์ดสูงเท่ากันทั้งแถว — แถว flex ยืดทุกใบ, ปุ่มเต็มความสูง (flex-col), ชื่อจองที่ 2 บรรทัด,
  //        แถบ + ตัวเลขชิดล่าง (mt-auto), บรรทัด "รอคืน" จองที่ไว้เสมอ
  return (
    <div className="relative flex w-64 flex-shrink-0">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={[
          "flex h-full w-full flex-col rounded-2xl border p-4 text-left transition",
          cancelled ? "bg-slate-50 opacity-70" : "bg-white",
          active
            ? "border-brand-primary ring-2 ring-brand-primary/30"
            : "border-admin-border hover:border-brand-primary/60",
          highlight ? "animate-pulse ring-2 ring-green-400" : "",
        ].join(" ")}
      >
        {/* pr-8 = ที่ของปุ่ม ⋯ ด้านขวาบน */}
        <div className="flex items-start justify-between gap-2 pr-8">
          {/* ชื่อล็อตขึ้นได้ 2 บรรทัด และจองความสูง 2 บรรทัดเสมอ (leading-snug 1.375 × 2 = 2.75em)
              ตัดที่ - _ / . ก่อน · [overflow-wrap:anywhere] ใช้เฉพาะช่วงที่ยาวเกินโดยไม่มีจุดตัด */}
          <div
            className="line-clamp-2 min-h-[2.75em] min-w-0 text-sm font-semibold leading-snug [overflow-wrap:anywhere]"
            title={lotLabel(b.importBatch)}
          >
            {breakableName(lotLabel(b.importBatch))}
          </div>
          <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill.cls}`}>
            {pill.text}
          </span>
        </div>

        <div className={`mt-2 flex items-center gap-1 text-xs ${urgent ? "text-red-600" : "text-admin-textMuted"}`}>
          <CalendarDays className="h-3.5 w-3.5" />
          <span>
            หมดอายุ {b.expiresYMD || "—"}
            {!cancelled && d !== null && (d >= 0 ? ` (เหลือ ${d} วัน)` : ` (เลยมา ${-d} วัน)`)}
            {` · ${b.total} ใบ`}
          </span>
        </div>

        <div className="mt-auto pt-3">
          {/* แถบ = สัดส่วนที่ออกจากคลังผ่านออเดอร์ (จองแล้ว + ส่งมอบแล้ว + รอคืน) ต่อทั้งหมด */}
          <div
            className="h-2 overflow-hidden rounded-full bg-slate-100"
            title={`ออกจากคลังแล้ว ${pct}% (จองแล้ว + ส่งมอบแล้ว + รอคืน)`}
          >
            <div
              className={`h-full rounded-full ${cancelled ? "bg-slate-400" : "bg-brand-primaryDark"}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* R5-3a: กระดาษ = ใช้แล้วเมื่อส่งมอบ · ส่งมอบแล้ว รวมใบที่รอคืน (กระดาษยังอยู่นอกคลัง) */}
          <div className="mt-3 grid grid-cols-3 divide-x divide-admin-border text-center">
            <div>
              <div className="text-[11px] text-admin-textMuted">พร้อมใช้</div>
              <div className={`text-base font-semibold ${cancelled ? "text-admin-textMuted" : "text-green-600"}`}>
                {b.available}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-admin-textMuted">จองแล้ว</div>
              <div className="text-base font-semibold">{b.assigned || 0}</div>
            </div>
            <div>
              <div className="text-[11px] text-admin-textMuted">ส่งมอบแล้ว</div>
              <div className="text-base font-semibold">{(b.handedOut || 0) + (b.awaitingReturn || 0)}</div>
              {/* จองบรรทัดไว้เสมอ — ไม่มีใบรอคืนก็ซ่อนแบบยังกินที่ (การ์ดสูงเท่ากัน) */}
              <div
                className={`text-[10px] leading-4 ${b.awaitingReturn > 0 ? "text-amber-700" : "invisible"}`}
                aria-hidden={b.awaitingReturn > 0 ? undefined : true}
              >
                รอคืน {b.awaitingReturn || 0}
              </div>
            </div>
          </div>
        </div>
      </button>

      {b.lotId && onAction && (
        <div className="absolute right-2 top-3">
          <LotMenu b={b} onAction={onAction} />
        </div>
      )}
    </div>
  );
}

// มุมมองเปลี่ยนในแท็บนี้ (event ของเราเอง) หรือแท็บอื่น (storage)
const LOT_VIEW_EVENT = "couponStock:lotView";
function subscribeLotView(cb) {
  window.addEventListener(LOT_VIEW_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(LOT_VIEW_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

// R5-3c: ใช้งานอยู่ / ปิดแล้ว / ทั้งหมด
function LotViewSwitch({ view, counts, onChange }) {
  return (
    <div className="inline-flex rounded-xl border border-admin-border bg-white p-0.5 text-xs" role="tablist">
      {LOT_VIEWS.map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={view === v}
          onClick={() => onChange(v)}
          className={[
            "rounded-lg px-3 py-1.5 transition",
            view === v
              ? "bg-brand-primary font-semibold text-[#0D1B2A]"
              : "text-admin-textMuted hover:text-admin-text",
          ].join(" ")}
        >
          {LOT_VIEW_LABELS[v]} ({counts[v]})
        </button>
      ))}
    </div>
  );
}

export default function LotCards({ batches, today, activeLot, highlightLot, onSelect, onAction, onImport }) {
  // อ่านค่าที่จำไว้ใน localStorage (server ใช้ "ใช้งานอยู่" เสมอ — ไม่มี hydration mismatch)
  const view = useSyncExternalStore(subscribeLotView, loadLotView, () => "active");
  function changeView(v) {
    saveLotView(v);
    window.dispatchEvent(new Event(LOT_VIEW_EVENT));
  }

  const sorted = sortLots(batches);
  const activeLots = sorted.filter(isLotActive);
  const closedLots = sorted.filter((b) => !isLotActive(b));
  const counts = { active: activeLots.length, closed: closedLots.length, all: sorted.length };
  const lots = view === "active" ? activeLots : view === "closed" ? closedLots : [...activeLots, ...closedLots];

  // ตัวกรองล็อตของตารางยังทำงานต่อแม้การ์ดของล็อตนั้นถูกซ่อนในมุมมองนี้ — แค่บอกให้รู้
  const selectedHidden =
    !!activeLot && sorted.some((b) => lotKey(b.importBatch, b.expiresYMD) === activeLot) &&
    !lots.some((b) => lotKey(b.importBatch, b.expiresYMD) === activeLot);

  return (
    <div className="rounded-2xl bg-admin-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">สต็อกแยกตามล็อต</h2>
          <p className="text-xs text-admin-textMuted">ภาพรวมจำนวนคูปองในแต่ละล็อต</p>
        </div>
        {sorted.length > 0 && <LotViewSwitch view={view} counts={counts} onChange={changeView} />}
      </div>

      {selectedHidden && (
        <p className="mt-2 text-xs text-admin-textMuted">
          ล็อตที่เลือกกรองตารางไว้ไม่อยู่ในมุมมองนี้ — ตารางยังกรองตามล็อตนั้นอยู่
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-admin-textMuted">ยังไม่มีล็อตคูปองในร้านนี้</p>
      ) : lots.length === 0 ? (
        view === "active" ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-admin-border p-4 text-sm text-admin-textMuted">
            ไม่มีล็อตที่ใช้งานอยู่ — นำเข้าล็อตใหม่
            {onImport && (
              <PrimaryButton onClick={onImport}>
                <Plus className="h-4 w-4" />
                นำเข้าคูปอง
              </PrimaryButton>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-admin-textMuted">ไม่มีล็อตที่ปิดแล้ว</p>
        )
      ) : (
        <div className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-2">
          {lots.map((b) => {
            const key = lotKey(b.importBatch, b.expiresYMD);
            return (
              <LotCard
                key={b.lotId || key}
                b={b}
                today={today}
                active={activeLot === key}
                highlight={highlightLot === key}
                onClick={() => onSelect(activeLot === key ? "" : key)}
                onAction={onAction}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
