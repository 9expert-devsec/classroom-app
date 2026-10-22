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
  expiryStatus,
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

// R5-3g: ยกเลิกแล้ว / ใช้หมดแล้ว แทนป้ายวันหมดอายุ · นอกนั้นใช้ expiryStatus (ล็อตไม่มีชื่อก็เหมือนล็อตอื่น)
function lotPill(b, exp) {
  if (isLotCancelled(b)) return { text: "ยกเลิกแล้ว", cls: "bg-slate-200 text-slate-600" };
  // R5-3c: ส่งมอบ / ยกเลิกรายใบหมดทุกใบ — ไม่เหลืออะไรให้ทำ
  if (!isLotActive(b)) return { text: "ใช้หมดแล้ว", cls: "bg-slate-100 text-slate-600" };
  if (!exp) return null;
  return { text: exp.label, cls: exp.pillCls };
}

// R5-3d: จำนวนใบจองที่วันเรียนผ่านไปแล้ว (summary.buckets.staleAssigned)
function staleCount(b) {
  return b?.buckets?.staleAssigned || 0;
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
        {/* R5-3d: ใบจองที่วันเรียนผ่านไปแล้ว — ล็อตยกเลิกแล้วก็รับคืนได้ (รหัสจะถูก void) */}
        {staleCount(b) > 0 && (
          <DropdownMenuItem onSelect={() => onAction("stale", b)}>รับคืนคูปองที่ไม่มารับ</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// R5-3i: ตัวเลขบนการ์ดไม่ซ้อนกัน — รวมกันได้เท่าจำนวนทั้งหมดของล็อต
//   พร้อมใช้ + รอส่งมอบ + ส่งมอบแล้ว (3 ช่อง) + ไม่มารับ + รอคืน (ชิป "ต้องจัดการ") + ยกเลิก (ท้ายบรรทัดวันที่)
export function lotCounts(b) {
  const stale = staleCount(b);
  return {
    available: b.available || 0,
    waiting: Math.max(0, (b.assigned || 0) - stale),
    handedOut: b.handedOut || 0,
    notCollected: stale,
    awaitingReturn: b.awaitingReturn || 0,
    voided: b.voided || 0,
  };
}

// ชิปสีเหลืองอำพันในบรรทัด "ต้องจัดการ" — กดได้
function ActionChip({ children, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
    >
      {children}
    </button>
  );
}

function LotCard({ b, today, active, highlight, onClick, onAction, onShowAwaiting }) {
  const c = lotCounts(b);
  const canReleaseStale = c.notCollected > 0 && !!b.lotId && !!onAction;
  const canShowAwaiting = c.awaitingReturn > 0 && !!onShowAwaiting;
  const cancelled = isLotCancelled(b);
  const exp = expiryStatus(today, b.expiresYMD);
  const pill = lotPill(b, exp);
  // R5-3g: บรรทัดวันที่ใช้สีเดียวกับป้ายวันหมดอายุ — ล็อตที่ยกเลิก / ใช้หมดแล้วไม่ต้องเตือน
  //         R5-3h: ระดับ "ปกติ" ใช้สีเทาตามเดิม (ป้ายยังเป็นสีเขียว) — สีไว้เตือนเฉพาะใกล้/หมดอายุ
  const showExpiry = !cancelled && isLotActive(b) && !!exp && exp.key !== "ok";
  const used = lotUsed(b);
  const pct = b.total > 0 ? Math.round((used / b.total) * 100) : 0;

  // R5-3b: การ์ดสูงเท่ากันทั้งแถว — แถว flex ยืดทุกใบ, ชื่อจองที่ 2 บรรทัด, แถบ + ตัวเลขชิดล่าง (mt-auto)
  // R5-3i: กรอบการ์ดอยู่ที่ div นอกสุด — ปุ่มการ์ด (เลือกล็อต) คือส่วนบน + ตัวเลข
  //        ส่วนล่างเป็นบรรทัด "ต้องจัดการ" ที่มีปุ่มของตัวเอง (ปุ่มซ้อนในปุ่มไม่ได้) จองความสูงไว้เสมอ
  return (
    <div
      className={[
        "relative flex w-64 flex-shrink-0 flex-col rounded-2xl border transition",
        cancelled ? "bg-slate-50 opacity-70" : "bg-white",
        active
          ? "border-brand-primary ring-2 ring-brand-primary/30"
          : "border-admin-border hover:border-brand-primary/60",
        highlight ? "animate-pulse ring-2 ring-green-400" : "",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className="flex w-full flex-1 flex-col rounded-t-2xl p-4 pb-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
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
          {pill && (
            <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill.cls}`}>
              {pill.text}
            </span>
          )}
        </div>

        <div className={`mt-2 flex items-center gap-1 text-xs ${showExpiry ? exp.textCls : "text-admin-textMuted"}`}>
          <CalendarDays className="h-3.5 w-3.5" />
          <span>
            หมดอายุ {b.expiresYMD || "—"}
            {!cancelled && exp && ` (${exp.dayText})`}
            {` · ${b.total} ใบ`}
            {c.voided > 0 && ` (ยกเลิก ${c.voided})`}
          </span>
        </div>

        <div className="mt-auto pt-3">
          {/* แถบ = สัดส่วนที่ออกจากคลังผ่านออเดอร์ (รอส่งมอบ + ส่งมอบแล้ว + ไม่มารับ + รอคืน) ต่อทั้งหมด */}
          <div
            className="h-2 overflow-hidden rounded-full bg-slate-100"
            title={`ออกจากคลังแล้ว ${pct}% (รอส่งมอบ + ส่งมอบแล้ว + ไม่มารับ + รอคืน)`}
          >
            <div
              className={`h-full rounded-full ${cancelled ? "bg-slate-400" : "bg-brand-primaryDark"}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* R5-3i: 3 ช่องนี้ไม่ซ้อนกัน — ไม่มารับ / รอคืน อยู่ในบรรทัด "ต้องจัดการ" ด้านล่าง */}
          <div className="mt-3 grid grid-cols-3 divide-x divide-admin-border text-center">
            <div>
              <div className="text-[11px] text-admin-textMuted">พร้อมใช้</div>
              <div className={`text-base font-semibold ${cancelled ? "text-admin-textMuted" : "text-green-600"}`}>
                {c.available}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-admin-textMuted">รอส่งมอบ</div>
              <div className="text-base font-semibold">{c.waiting}</div>
            </div>
            <div>
              <div className="text-[11px] text-admin-textMuted">ส่งมอบแล้ว</div>
              <div className="text-base font-semibold">{c.handedOut}</div>
            </div>
          </div>
        </div>
      </button>

      {/* R5-3i: ต้องจัดการ — แสดงเฉพาะที่มี (ไม่มีอะไรก็ยังกินที่ การ์ดสูงเท่ากัน) */}
      <div className="flex min-h-[2rem] flex-wrap items-center gap-1.5 border-t border-admin-border/60 px-4 py-1.5">
        {c.notCollected > 0 || c.awaitingReturn > 0 ? (
          <>
            <span className="text-[11px] text-admin-textMuted">ต้องจัดการ</span>
            {c.notCollected > 0 &&
              (canReleaseStale ? (
                <ActionChip
                  onClick={() => onAction("stale", b)}
                  title="วันเรียนผ่านไปแล้วแต่ผู้เรียนไม่ได้มารับคูปอง — กดเพื่อรับคืนเข้าคลัง"
                >
                  ไม่มารับ {c.notCollected}
                </ActionChip>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  ไม่มารับ {c.notCollected}
                </span>
              ))}
            {c.awaitingReturn > 0 &&
              (canShowAwaiting ? (
                <ActionChip
                  onClick={() => onShowAwaiting(b)}
                  title="กระดาษยังอยู่นอกคลัง — กดเพื่อดูรายการรอคืนของล็อตนี้"
                >
                  รอคืน {c.awaitingReturn}
                </ActionChip>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  รอคืน {c.awaitingReturn}
                </span>
              ))}
          </>
        ) : (
          <span className="invisible text-[11px]" aria-hidden>
            ต้องจัดการ
          </span>
        )}
      </div>

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

export default function LotCards({ batches, today, activeLot, highlightLot, onSelect, onAction, onImport, onShowAwaiting }) {
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
                onShowAwaiting={onShowAwaiting}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
