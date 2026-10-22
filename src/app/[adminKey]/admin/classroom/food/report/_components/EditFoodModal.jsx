"use client";

// admin edit of a learner's food choice — POST /api/checkin/food (single write path),
// not bound by the 15:00 cutoff. Mounted per row (key = row id). Today only (R4-1).
// R4-5B: choices come only from that class's Food Calendar plan for the day
//        (GET /api/admin/food/day-options -> getFoodDayOptions, same source as the kiosk food step);
//        the server rejects anything off-plan with 409.
// R2b: saving never issues a lunch QR by itself. After a coupon save (today, before close,
//      no live order) the success state offers "ออก QR ทันที" — a separate, explicit call to
//      POST /api/admin/lunch/issue, which re-validates everything server-side.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, Check, Loader2, Search, X } from "lucide-react";

import { stripAutoFoodNote } from "@/lib/foodNotes";
import { LUNCH_BUDGET_THB } from "@/lib/lunchConfig";
import { postLunchAdmin } from "@/components/admin/lunch/lunchApi";
import QrLinkModal from "../../lunch-orders/_components/QrLinkModal";
import Modal from "./Modal";
import {
  classDayIndex,
  couponRestaurantName,
  couponStateText,
  cx,
  dayHeaderLabel,
  formatDateDMY,
  rowType,
  sourceBadge,
} from "./reportUi";

const SEGMENTS = [
  ["food", "Set อาหาร"],
  ["coupon", "คูปอง"],
  ["noFood", "ไม่รับอาหาร"],
];

const OFF_PLAN_MESSAGE = "ตัวเลือกเดิมไม่อยู่ในแผนวันนี้ — กรุณาเลือกใหม่จากแผน Food Calendar ก่อนบันทึก";

function initialChoice(row) {
  const t = rowType(row);
  // R4-2: วันนี้ยังไม่เลือก -> เปิดโมดัลแบบยังไม่มีตัวเลือก
  if (t === "not_chosen" || t === "no_data") return "";
  return t === "coupon" ? "coupon" : t === "none" ? "noFood" : "food";
}

function SectionTitle({ id, children, right }) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h3 id={id} className="text-sm font-semibold text-admin-text">
        {children}
      </h3>
      {right}
    </div>
  );
}

function Chip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-sm transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-1",
        selected
          ? "border-brand-primary bg-brand-primary/15 font-semibold text-sky-800"
          : "border-admin-border bg-white text-admin-text hover:border-brand-primary",
      )}
    >
      {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export default function EditFoodModal({ row, todayYMD = "", onClose, onSaved }) {
  const { adminKey } = useParams();
  const f = row.food || {};
  // C5c: ใช้ type ที่ server ตัดสินแล้ว (LunchOrder ชนะ Student.food)
  const startChoice = initialChoice(row);
  // the report day of this row (range rows carry dayYMD)
  const reportYMD = row.dayYMD;
  // วันเรียนที่เท่าไร — server คำนวณให้แถวแล้ว (row.day) · ข้อมูลเก่าไม่มี -> นับจากวันเริ่มคลาส
  const classDay = Number(row.day) > 0 ? Number(row.day) : classDayIndex(row.classDate || null, reportYMD);

  const modalTitle = `แก้ไขอาหาร: ${row?.studentName || ""}`;
  // R4-3: "วันเรียนที่ n/N · dd/MM/yyyy" (คลาสวันเดียว: วันที่อย่างเดียว)
  const subLine = [
    String(row.className || row.classTitle || "").trim(),
    row.roomName ? `ห้อง ${row.roomName}` : "",
    reportYMD ? dayHeaderLabel({ day: classDay, classDayCount: row.classDayCount, dayYMD: reportYMD }) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const [opts, setOpts] = useState(null); // { set, coupon, noFood, dayYMD }
  const [loadError, setLoadError] = useState("");
  const [loadTick, setLoadTick] = useState(0);

  const [choiceType, setChoiceType] = useState(startChoice); // food | coupon | noFood | ""
  const [restaurantId, setRestaurantId] = useState("");
  const [menuId, setMenuId] = useState("");
  const [addonIds, setAddonIds] = useState([]);
  const [drinkId, setDrinkId] = useState("");
  const [query, setQuery] = useState("");
  const [offPlan, setOffPlan] = useState(false);
  // R2b: ไม่ prefill โน้ตอัตโนมัติเดิม ("COUPON" / "ไม่รับอาหาร")
  const [note, setNote] = useState(stripAutoFoodNote(f.note ?? row.note ?? ""));

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  // R2b: หลังบันทึกเป็นคูปองแล้วยังไม่มี QR -> แสดงหน้าบันทึกสำเร็จ + ปุ่ม "ออก QR ทันที"
  const [savedCoupon, setSavedCoupon] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [qr, setQr] = useState(null);

  const panelRef = useRef(null);

  // ---- load the day's plan, then reconcile the prefill against it (once per load) ----
  useEffect(() => {
    let alive = true;
    setLoadError("");
    (async () => {
      try {
        const qs = new URLSearchParams({ classId: String(row.classId || ""), day: String(classDay) });
        const res = await fetch(`/api/admin/food/day-options?${qs.toString()}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok || !data?.ok) {
          setLoadError(data?.error || "โหลดตัวเลือกตามแผน Food Calendar ไม่สำเร็จ");
          return;
        }
        applyPrefill(data);
        setOpts(data);
      } catch (err) {
        console.error(err);
        if (alive) setLoadError("โหลดตัวเลือกตามแผน Food Calendar ไม่สำเร็จ");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTick]);

  // ตัวเลือกเดิมของวันนี้ -> ใช้ได้เฉพาะส่วนที่อยู่ในแผน ส่วนที่หลุดแผนถูกล้าง + แสดงคำเตือน
  function applyPrefill(o) {
    let off = false;
    if (startChoice === "food") {
      const prevRest = String(f.restaurantId ?? row.restaurantId ?? "");
      const prevMenu = String(f.menuId ?? row.menuId ?? "");
      const r = (o.set?.restaurants || []).find((x) => x.id === prevRest);
      const m = r?.menus.find((x) => x.id === prevMenu);
      if (!r) {
        off = !!(prevRest || prevMenu);
      } else if (!m) {
        off = true;
        setRestaurantId(r.id);
      } else {
        setRestaurantId(r.id);
        setMenuId(m.id);
        // FoodChoice เก็บชื่อ add-on/เครื่องดื่ม -> map เป็น id ของเมนูนี้
        const prevAddons = Array.isArray(f.addons) ? f.addons : Array.isArray(row.addons) ? row.addons : [];
        const ids = prevAddons.map((name) => m.addons.find((a) => a.name === name)?.id || "");
        if (ids.some((x) => !x)) off = true;
        setAddonIds(ids.filter(Boolean));
        const prevDrink = String(f.drink ?? row.drink ?? "");
        if (prevDrink) {
          const d = m.drinks.find((x) => x.name === prevDrink);
          if (!d) off = true;
          setDrinkId(d?.id || "");
        }
      }
    } else if (startChoice === "coupon" && !o.coupon?.available) {
      off = true;
      setChoiceType("");
    }
    setOffPlan(off);
  }

  // Esc ปิด (หน้าบันทึกคูปองสำเร็จ = ปิดแล้วโหลดรายงานใหม่ · หน้า QR จัดการเอง) · โฟกัสเข้าโมดัลตอนเปิด
  const escRef = useRef(onClose);
  escRef.current = qr ? null : savedCoupon ? () => onSaved() : onClose;
  useEffect(() => {
    panelRef.current?.focus();
    function onKey(e) {
      if (e.key === "Escape") escRef.current?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- derived ----
  const restaurants = useMemo(() => opts?.set?.restaurants || [], [opts]);
  // ร้านเดียวในแผน -> เลือกให้อัตโนมัติ
  const effRestaurantId = restaurantId || (restaurants.length === 1 ? restaurants[0].id : "");
  const restaurant = restaurants.find((r) => r.id === effRestaurantId) || null;
  const menu = restaurant?.menus.find((m) => m.id === menuId) || null;

  const visibleMenus = useMemo(() => {
    const list = restaurant?.menus || [];
    const q = query.trim().toLowerCase();
    return q ? list.filter((m) => String(m.name || "").toLowerCase().includes(q)) : list;
  }, [restaurant, query]);

  const available = {
    food: !!opts?.set?.available,
    coupon: !!opts?.coupon?.available,
    noFood: true,
  };

  const complete =
    !!opts &&
    (choiceType === "noFood" ||
      (choiceType === "coupon" && available.coupon) ||
      (choiceType === "food" && !!restaurant && !!menu));

  const summary = (() => {
    if (choiceType === "coupon") return `คูปอง ${LUNCH_BUDGET_THB} บาท`;
    if (choiceType === "noFood") return "ไม่รับอาหาร";
    if (choiceType === "food") {
      if (!restaurant) return "ยังไม่ได้เลือกร้าน";
      if (!menu) return `${restaurant.name} · ยังไม่ได้เลือกเมนู`;
      const addonNames = menu.addons.filter((a) => addonIds.includes(a.id)).map((a) => a.name);
      const drink = menu.drinks.find((d) => d.id === drinkId);
      return [
        restaurant.name,
        [menu.name, ...addonNames].join(" + "),
        drink?.name || "",
      ]
        .filter(Boolean)
        .join(" · ");
    }
    return "ยังไม่เลือก";
  })();

  // ---- actions ----
  // สลับประเภท → ล้าง restaurant/menu/addon/drink ทุกครั้ง กันส่ง id ค้างข้ามประเภท
  function switchChoiceType(next) {
    if (next === choiceType) return;
    setChoiceType(next);
    setRestaurantId("");
    setMenuId("");
    setAddonIds([]);
    setDrinkId("");
    setQuery("");
    setSaveError("");
  }

  function pickRestaurant(id) {
    if (id === effRestaurantId) return;
    setRestaurantId(id);
    setMenuId("");
    setAddonIds([]);
    setDrinkId("");
    setQuery("");
  }

  function pickMenu(id) {
    if (id === menuId) return;
    setMenuId(id);
    setAddonIds([]);
    setDrinkId("");
  }

  function toggleAddon(id) {
    setAddonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function saveEdit() {
    if (!row?.studentId || !complete || saving) return;

    setSaving(true);
    setSaveError("");
    try {
      const base = {
        studentId: row.studentId,
        classId: row.classId || "",
        day: classDay,
        note: stripAutoFoodNote(note),
      };
      const empty = { restaurantId: "", menuId: "", addonIds: [], drinkId: "", addons: [], drink: "" };

      let payload;
      if (choiceType === "coupon") {
        // noFood: backward compat (API ก็เซ็ต noFood true อยู่แล้ว)
        payload = { ...base, ...empty, choiceType: "coupon", coupon: true, noFood: true };
      } else if (choiceType === "noFood") {
        payload = { ...base, ...empty, choiceType: "noFood", coupon: false, noFood: true };
      } else {
        const addons = menu.addons.filter((a) => addonIds.includes(a.id));
        const drink = menu.drinks.find((d) => d.id === drinkId);
        payload = {
          ...base,
          choiceType: "food",
          coupon: false,
          noFood: false,
          restaurantId: restaurant.id,
          menuId: menu.id,
          addonIds: addons.map((a) => a.id),
          drinkId: drink?.id || "",
          // legacy strings (เก็บไว้ให้ report/export เดิม)
          addons: addons.map((a) => a.name),
          drink: drink?.name || "",
        };
      }

      const res = await fetch("/api/checkin/food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(out);
        setSaveError(out.error || "บันทึกไม่สำเร็จ");
        setSaving(false);
        return;
      }

      // R2b: คูปอง + วันนี้ + ยังไม่ถึงเวลาปิด (dayFinalClosed มาจาก server ตาม lunchTimes)
      //      + ยังไม่มีออเดอร์ live -> เสนอ "ออก QR ทันที" (ไม่ออกให้เอง)
      if (
        choiceType === "coupon" &&
        !!todayYMD &&
        reportYMD === todayYMD &&
        !row.dayFinalClosed &&
        !row.orderId
      ) {
        setSaving(false);
        setSavedCoupon(true);
        return;
      }

      await onSaved();
      return;
    } catch (err) {
      console.error(err);
      setSaveError("เกิดข้อผิดพลาดในการบันทึก");
    }
    setSaving(false);
  }

  // R2b: ปุ่มลัด — server ตรวจซ้ำทุกข้อ (วันนี้ / ก่อนเวลาปิด / ตัวเลือกเป็นคูปอง / เช็คอินแล้ว / ไม่มีใบ live)
  async function issueNow() {
    setIssuing(true);
    setIssueError("");
    try {
      const r = await postLunchAdmin("/api/admin/lunch/issue", {
        classId: row.classId || "",
        studentId: row.studentId,
      });
      setQr({
        title: "ออก QR แล้ว",
        url: r.qrUrl,
        name: row.studentName || "",
        nickname: "",
        className: row.className || "",
        room: row.roomName || "",
        status: "pending",
        deadlineAt: r.deadlineAt || null,
      });
    } catch (e) {
      setIssueError(e.message || "ออก QR ไม่สำเร็จ");
    } finally {
      setIssuing(false);
    }
  }

  if (qr) return <QrLinkModal qr={qr} onClose={() => onSaved()} />;

  if (savedCoupon) {
    return (
      <Modal open title={modalTitle} onClose={() => onSaved()}>
        <div className="space-y-4" data-testid="edit-food-saved">
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            บันทึกแล้ว — ตัวเลือกเป็น COUPON
          </div>
          <p className="text-[12px] text-admin-textMuted">
            การบันทึกไม่ออก QR ให้เอง ผู้เรียนยังไม่มี QR สั่งอาหารของวันนี้ — ออกได้ที่นี่
            หรือที่หน้าติดตามการสั่งอาหาร
          </p>
          {issueError ? <p className="text-sm text-red-600">{issueError}</p> : null}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onSaved()}
              disabled={issuing}
              className="rounded-xl border border-admin-border bg-white px-3 py-2 text-sm hover:bg-admin-surfaceMuted disabled:opacity-50"
            >
              ปิด
            </button>
            <button
              type="button"
              data-testid="issue-qr-now"
              onClick={issueNow}
              disabled={issuing}
              className={cx(
                "rounded-xl px-4 py-2 text-sm font-semibold",
                issuing
                  ? "bg-admin-border text-admin-textMuted"
                  : "bg-brand-primary text-white hover:opacity-90",
              )}
            >
              {issuing ? "กำลังออก QR..." : "ออก QR ทันที"}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  const unavailableReasons = [
    !available.food && opts?.set?.reason ? `Set อาหาร: ${opts.set.reason}` : "",
    !available.coupon && opts?.coupon?.reason ? `คูปอง: ${opts.coupon.reason}` : "",
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-food-title"
        aria-describedby="edit-food-sub"
        tabIndex={-1}
        data-testid="edit-food-modal"
        className="relative flex max-h-[calc(100svh-2rem)] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-admin-border px-5 pb-3 pt-4">
          <div className="min-w-0">
            <h2 id="edit-food-title" className="text-xl font-bold leading-snug text-admin-text">
              {modalTitle}
            </h2>
            <p id="edit-food-sub" className="mt-0.5 text-sm text-admin-textMuted">
              {subLine}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-admin-text hover:bg-admin-surfaceMuted focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {!opts && !loadError ? (
            <div className="flex items-center gap-2 py-6 text-sm text-admin-textMuted" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              กำลังโหลดตัวเลือกตามแผน Food Calendar…
            </div>
          ) : null}

          {loadError ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => setLoadTick((n) => n + 1)}
                className="min-h-[44px] rounded-lg border border-red-300 bg-white px-3 text-sm font-semibold text-red-800 hover:bg-red-100"
              >
                ลองใหม่
              </button>
            </div>
          ) : null}

          {opts ? (
            <>
              {offPlan ? (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{OFF_PLAN_MESSAGE}</span>
                </div>
              ) : null}

              {/* Type picker */}
              <div>
                <div
                  role="group"
                  aria-label="ประเภทอาหาร"
                  className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1"
                >
                  {SEGMENTS.map(([value, label]) => {
                    const selected = choiceType === value;
                    const enabled = available[value];
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={selected}
                        disabled={!enabled}
                        onClick={() => switchChoiceType(value)}
                        className={cx(
                          "h-11 rounded-lg px-2 text-sm font-semibold transition",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-700",
                          selected && enabled && "bg-white text-sky-800 shadow-sm",
                          selected && !enabled && "bg-white/60 text-slate-500 line-through",
                          !selected && enabled && "text-admin-text hover:bg-white/70",
                          !enabled && "cursor-not-allowed",
                          !selected && !enabled && "text-slate-500 line-through",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {unavailableReasons.map((t) => (
                  <p key={t} className="mt-1.5 text-xs text-admin-textMuted">
                    {t}
                  </p>
                ))}
              </div>

              {/* Set */}
              {choiceType === "food" && !available.food ? (
                <div className="rounded-xl border border-dashed border-admin-border bg-admin-surfaceMuted p-5 text-center text-sm text-admin-text">
                  <p className="font-semibold">วันนี้ไม่มีร้าน Set ในแผน Food Calendar</p>
                  <p className="mt-1 text-admin-textMuted">เลือก &quot;คูปอง&quot; หรือ &quot;ไม่รับอาหาร&quot; แทน หรือเพิ่มร้าน Set ในแผนของวันนี้</p>
                  <Link
                    href={`/${adminKey}/admin/classroom/food/calendar`}
                    className="mt-3 inline-flex min-h-[44px] items-center rounded-lg px-3 font-semibold text-sky-800 underline underline-offset-2 hover:bg-white"
                  >
                    เปิด Food Calendar ({formatDateDMY(opts.dayYMD || reportYMD)})
                  </Link>
                </div>
              ) : null}

              {choiceType === "food" && available.food ? (
                <>
                  <section role="group" aria-labelledby="ef-rest">
                    <SectionTitle id="ef-rest">ร้าน · ตามแผน Food Calendar วันนี้</SectionTitle>
                    <div className={cx("grid gap-2", restaurants.length > 1 && "sm:grid-cols-2")}>
                      {restaurants.map((r) => {
                        const selected = r.id === effRestaurantId;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => pickRestaurant(r.id)}
                            className={cx(
                              "flex min-h-[56px] items-center justify-between gap-3 rounded-xl border-2 px-4 py-2 text-left transition",
                              "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-1",
                              selected
                                ? "border-brand-primary bg-brand-primary/10"
                                : "border-admin-border bg-white hover:border-brand-primary",
                            )}
                          >
                            <span className="min-w-0">
                              <span className={cx("block truncate font-semibold", selected ? "text-sky-800" : "text-admin-text")}>
                                {r.name}
                              </span>
                              <span className="block text-xs text-admin-textMuted">{r.menus.length} เมนู</span>
                            </span>
                            {selected ? (
                              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-800 text-white">
                                <Check className="h-4 w-4" aria-hidden="true" />
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {restaurant ? (
                    <section role="group" aria-labelledby="ef-menu">
                      <SectionTitle
                        id="ef-menu"
                        right={
                          <label className="relative block w-full sm:w-56">
                            <span className="sr-only">ค้นหาเมนู</span>
                            <Search
                              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-textMuted"
                              aria-hidden="true"
                            />
                            <input
                              type="search"
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                              placeholder="ค้นหาเมนู"
                              className="h-11 w-full rounded-lg border border-admin-border bg-white pl-9 pr-3 text-sm text-admin-text placeholder:text-admin-textMuted focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/30"
                            />
                          </label>
                        }
                      >
                        เมนู Set ของวันนี้
                      </SectionTitle>
                      {visibleMenus.length === 0 ? (
                        <p className="rounded-xl bg-admin-surfaceMuted p-4 text-center text-sm text-admin-textMuted">
                          ไม่พบเมนูที่ค้นหาในแผนวันนี้
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {visibleMenus.map((m) => {
                            const selected = m.id === menuId;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => pickMenu(m.id)}
                                className={cx(
                                  "relative min-h-[64px] rounded-xl border-2 px-3 py-2 pr-9 text-left text-sm transition",
                                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-1",
                                  selected
                                    ? "border-brand-primary bg-brand-primary/10 font-semibold text-sky-800"
                                    : "border-admin-border bg-white text-admin-text hover:border-brand-primary",
                                )}
                              >
                                {m.name}
                                {selected ? (
                                  <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-800 text-white">
                                    <Check className="h-4 w-4" aria-hidden="true" />
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  ) : null}

                  {menu ? (
                    <div className="grid gap-5 md:grid-cols-2">
                      <section role="group" aria-labelledby="ef-addon">
                        <SectionTitle id="ef-addon">Add-on (เลือกได้หลายอย่าง)</SectionTitle>
                        {menu.addons.length ? (
                          <div className="flex flex-wrap gap-2">
                            {menu.addons.map((a) => (
                              <Chip key={a.id} selected={addonIds.includes(a.id)} onClick={() => toggleAddon(a.id)}>
                                {a.name}
                              </Chip>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-admin-textMuted">ไม่มี Add-on สำหรับเมนูนี้</p>
                        )}
                      </section>
                      <section role="group" aria-labelledby="ef-drink">
                        <SectionTitle id="ef-drink">เครื่องดื่ม (เลือก 1)</SectionTitle>
                        {menu.drinks.length ? (
                          <div className="flex flex-wrap gap-2">
                            {menu.drinks.map((d) => (
                              <Chip
                                key={d.id}
                                selected={drinkId === d.id}
                                onClick={() => setDrinkId((cur) => (cur === d.id ? "" : d.id))}
                              >
                                {d.name}
                              </Chip>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-admin-textMuted">ไม่มีเครื่องดื่มสำหรับเมนูนี้</p>
                        )}
                      </section>
                    </div>
                  ) : null}
                </>
              ) : null}

              {/* Coupon */}
              {choiceType === "coupon" ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-admin-text">
                    <span className="font-semibold">คูปอง {LUNCH_BUDGET_THB} บาท</span> — ร้านคูปองตามแผนวันนี้:{" "}
                    {opts.coupon.restaurants.length ? opts.coupon.restaurants.join(", ") : "-"}
                  </div>
                  {/* C5c: ข้อมูลคูปองของวันนี้ (อ่านอย่างเดียว) — ออเดอร์คูปองจัดการใน lunch flow */}
                  {rowType(row) === "coupon" ? (
                    <div className="rounded-xl border border-admin-border bg-admin-surfaceMuted p-3 text-[13px] text-admin-text">
                      <div className="text-xs font-semibold text-admin-text">คูปองวันนี้ของผู้เรียน</div>
                      <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                        <span className="text-admin-textMuted">ร้าน</span>
                        <span>{couponRestaurantName(row) || "-"}</span>
                        <span className="text-admin-textMuted">สถานะ</span>
                        <span>{couponStateText(row)}</span>
                        <span className="text-admin-textMuted">Code</span>
                        <span className="font-mono">{row.code ? `${sourceBadge(row)} · ${row.code}` : "-"}</span>
                      </div>
                      <div className="mt-2 text-xs text-admin-textMuted">
                        ออเดอร์คูปองจัดการในหน้าติดตามการสั่งอาหาร — การแก้ไขที่นี่ไม่สร้างออเดอร์หรือ QR
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* No food */}
              {choiceType === "noFood" ? (
                <p className="rounded-xl bg-admin-surfaceMuted p-4 text-sm text-admin-text">
                  ผู้เรียนไม่รับอาหารกลางวันของวันนี้
                </p>
              ) : null}

              {/* Note */}
              <div>
                <label htmlFor="ef-note" className="mb-1 block text-sm font-semibold text-admin-text">
                  หมายเหตุ <span className="font-normal text-admin-textMuted">(ไม่บังคับ)</span>
                </label>
                <textarea
                  id="ef-note"
                  className="w-full rounded-lg border border-admin-border bg-white px-3 py-2 text-sm text-admin-text placeholder:text-admin-textMuted focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/30"
                  rows={2}
                  placeholder="เช่น แพ้อาหาร / ไม่ใส่ผัก / ฯลฯ"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-admin-border bg-admin-surfaceMuted px-5 py-3">
          {saveError ? (
            <p role="alert" className="mb-2 text-sm font-semibold text-red-700">
              {saveError}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 flex-1 text-sm text-admin-text" aria-live="polite">
              <span className="mr-2 font-semibold">สรุป</span>
              <span className="break-words" data-testid="edit-food-summary">
                {summary}
              </span>
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-xl border border-admin-border bg-white px-4 text-sm font-semibold text-admin-text hover:bg-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-700"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={saveEdit}
                // R4-2: ยังไม่เลือก -> ต้องเลือกก่อนบันทึก · Set ต้องมีเมนู
                disabled={saving || !complete}
                className={cx(
                  "h-11 rounded-xl px-5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-1",
                  saving || !complete
                    ? "cursor-not-allowed bg-admin-border text-slate-500"
                    : "bg-sky-800 text-white hover:bg-sky-900",
                )}
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
