"use client";

// admin edit of a learner's food choice — same flow as before (POST /api/checkin/food),
// not bound by the 15:00 cutoff. Mounted per row (key = row id).
// R2b: saving never issues a lunch QR by itself. After a coupon save (today, before close,
//      no live order) the success state offers "ออก QR ทันที" — a separate, explicit call to
//      POST /api/admin/lunch/issue, which re-validates everything server-side.
import { useEffect, useMemo, useState } from "react";

import { stripAutoFoodNote } from "@/lib/foodNotes";
import { postLunchAdmin } from "@/components/admin/lunch/lunchApi";
import QrLinkModal from "../../lunch-orders/_components/QrLinkModal";
import Modal from "./Modal";
import {
  classDayIndex,
  couponRestaurantName,
  couponStateText,
  cx,
  rowType,
  sourceBadge,
} from "./reportUi";

function initialChoice(row) {
  const t = rowType(row);
  return t === "coupon" ? "coupon" : t === "none" ? "noFood" : "food";
}

export default function EditFoodModal({ row, todayYMD = "", onClose, onSaved }) {
  const f = row.food || {};
  // C5c: ใช้ type ที่ server ตัดสินแล้ว (LunchOrder ชนะ Student.food)
  const startChoice = initialChoice(row);
  const startIsFood = startChoice === "food";
  // the report day of this row (range rows carry dayYMD)
  const reportYMD = row.dayYMD;

  const [editChoiceType, setEditChoiceType] = useState(startChoice); // food | noFood | coupon
  const [editRestaurantId, setEditRestaurantId] = useState(
    startIsFood ? String(f.restaurantId ?? row.restaurantId ?? "") : "",
  );
  const [editMenuId, setEditMenuId] = useState(
    startIsFood ? String(f.menuId ?? row.menuId ?? "") : "",
  );
  const [editAddons, setEditAddons] = useState(() =>
    Array.isArray(f.addons) ? f.addons : Array.isArray(row.addons) ? row.addons : [],
  );
  const [editDrink, setEditDrink] = useState(String(f.drink ?? row.drink ?? ""));
  // R2b: ไม่ prefill โน้ตอัตโนมัติเดิม ("COUPON" / "ไม่รับอาหาร")
  const [editNote, setEditNote] = useState(stripAutoFoodNote(f.note ?? row.note ?? ""));
  const [savingEdit, setSavingEdit] = useState(false);
  // R2b: หลังบันทึกเป็นคูปองแล้วยังไม่มี QR -> แสดงหน้าบันทึกสำเร็จ + ปุ่ม "ออก QR ทันที"
  const [savedCoupon, setSavedCoupon] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [qr, setQr] = useState(null);

  const [foodOptions, setFoodOptions] = useState([]);
  const [optLoading, setOptLoading] = useState(false);
  const [addonOptions, setAddonOptions] = useState([]); // [{id,name}]
  const [drinkOptions, setDrinkOptions] = useState([]); // [{id,name}]

  const currentRestaurant = useMemo(() => {
    if (!editRestaurantId) return null;
    return (foodOptions || []).find((r) => String(r.id) === String(editRestaurantId)) || null;
  }, [foodOptions, editRestaurantId]);

  const currentMenu = useMemo(() => {
    if (!currentRestaurant || !editMenuId) return null;
    return (currentRestaurant.menus || []).find((m) => String(m.id) === String(editMenuId)) || null;
  }, [currentRestaurant, editMenuId]);

  const addonMap = useMemo(() => {
    const m = new Map();
    (addonOptions || []).forEach((x) => m.set(String(x.id), x));
    return m;
  }, [addonOptions]);

  const drinkMap = useMemo(() => {
    const m = new Map();
    (drinkOptions || []).forEach((x) => m.set(String(x.id), x));
    return m;
  }, [drinkOptions]);

  const currentAddonChoices = useMemo(() => {
    const ids = Array.isArray(currentMenu?.addonIds) ? currentMenu.addonIds : [];
    const fromIds = ids
      .map((id) => addonMap.get(String(id)))
      .filter(Boolean)
      .map((x) => x.name);
    if (fromIds.length) return fromIds;
    if (Array.isArray(currentMenu?.addons)) return currentMenu.addons;
    return [];
  }, [currentMenu, addonMap]);

  const currentDrinkChoices = useMemo(() => {
    const ids = Array.isArray(currentMenu?.drinkIds) ? currentMenu.drinkIds : [];
    const fromIds = ids
      .map((id) => drinkMap.get(String(id)))
      .filter(Boolean)
      .map((x) => x.name);
    if (fromIds.length) return fromIds;
    if (Array.isArray(currentMenu?.drinks)) return currentMenu.drinks;
    return [];
  }, [currentMenu, drinkMap]);

  async function loadFoodOptions() {
    setOptLoading(true);
    try {
      const qs = new URLSearchParams();
      if (row.studentId) qs.set("studentId", row.studentId);
      if (row.classId) qs.set("classId", row.classId);
      qs.set("day", String(classDayIndex(row.classDate || null, reportYMD)));

      const res = await fetch(`/api/admin/food/today?${qs.toString()}`, { cache: "no-store" });
      const data = await res.json();

      const items = Array.isArray(data.items) ? data.items : [];
      setFoodOptions(items);

      // addons: รองรับหลาย key + ฝังใน items
      const directAddons =
        (Array.isArray(data.addons) && data.addons) ||
        (Array.isArray(data.addonOptions) && data.addonOptions) ||
        (Array.isArray(data.options?.addons) && data.options.addons) ||
        [];
      const nestedAddons = items.flatMap((r) =>
        Array.isArray(r.addons) ? r.addons : Array.isArray(r.addonOptions) ? r.addonOptions : [],
      );
      const uniqAddons = [];
      const seenAddon = new Set();
      [...directAddons, ...nestedAddons].forEach((x) => {
        const id = String(x?.id || x?._id || "");
        if (!id || seenAddon.has(id)) return;
        seenAddon.add(id);
        uniqAddons.push({ id, name: x?.name || x?.title || "-" });
      });
      setAddonOptions(uniqAddons);

      // drinks: รองรับหลาย key + ฝังใน items
      const directDrinks =
        (Array.isArray(data.drinks) && data.drinks) ||
        (Array.isArray(data.drinkOptions) && data.drinkOptions) ||
        (Array.isArray(data.options?.drinks) && data.options.drinks) ||
        [];
      const nestedDrinks = items.flatMap((r) =>
        Array.isArray(r.drinks) ? r.drinks : Array.isArray(r.drinkOptions) ? r.drinkOptions : [],
      );
      const uniqDrinks = [];
      const seenDrink = new Set();
      [...directDrinks, ...nestedDrinks].forEach((x) => {
        const id = String(x?.id || x?._id || "");
        if (!id || seenDrink.has(id)) return;
        seenDrink.add(id);
        uniqDrinks.push({ id, name: x?.name || x?.title || "-" });
      });
      setDrinkOptions(uniqDrinks);
    } catch (err) {
      console.error(err);
      setFoodOptions([]);
      setAddonOptions([]);
      setDrinkOptions([]);
    } finally {
      setOptLoading(false);
    }
  }

  // options load whenever the "food" choice is showing and nothing is loaded yet
  useEffect(() => {
    if (editChoiceType !== "food") return;
    if ((foodOptions || []).length === 0 && !optLoading) {
      loadFoodOptions().catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editChoiceType]);

  // สลับสถานะใน modal → ล้าง restaurant/menu/addon/drink ทุกครั้ง กันส่ง id ค้างข้ามประเภท
  function switchEditChoiceType(next) {
    if (next === editChoiceType) return;
    setEditChoiceType(next);
    setEditRestaurantId("");
    setEditMenuId("");
    setEditAddons([]);
    setEditDrink("");
  }

  function toggleAddon(name) {
    setEditAddons((prev) => {
      const set = new Set(prev);
      if (set.has(name)) set.delete(name);
      else set.add(name);
      return Array.from(set);
    });
  }

  async function saveEdit() {
    if (!row?.studentId) return;

    setSavingEdit(true);
    try {
      const cleanedNote = stripAutoFoodNote(editNote);

      const payloadBase = {
        studentId: row.studentId,
        classId: row.classId || "",
        day: classDayIndex(row.classDate || null, reportYMD),
      };

      // map ชื่อ -> id เพื่อให้ API validate ผ่าน
      const addonIds = (Array.isArray(editAddons) ? editAddons : [])
        .map((name) => {
          const hit = (addonOptions || []).find((x) => String(x?.name) === String(name));
          return hit ? String(hit.id) : "";
        })
        .filter(Boolean);

      const drinkId = (() => {
        const hit = (drinkOptions || []).find((x) => String(x?.name) === String(editDrink));
        return hit ? String(hit.id) : "";
      })();

      let payload;
      if (editChoiceType === "coupon") {
        payload = {
          ...payloadBase,
          choiceType: "coupon",
          coupon: true,
          noFood: true, // backward compat (API ก็เซ็ต noFood true อยู่แล้ว)
          restaurantId: "",
          menuId: "",
          addonIds: [],
          drinkId: "",
          addons: [],
          drink: "",
          note: cleanedNote,
        };
      } else if (editChoiceType === "noFood") {
        payload = {
          ...payloadBase,
          choiceType: "noFood",
          coupon: false,
          noFood: true,
          restaurantId: "",
          menuId: "",
          addonIds: [],
          drinkId: "",
          addons: [],
          drink: "",
          note: cleanedNote,
        };
      } else {
        payload = {
          ...payloadBase,
          choiceType: "food",
          coupon: false,
          noFood: false,
          restaurantId: editRestaurantId || "",
          menuId: editMenuId || "",
          addonIds,
          drinkId, // เมนูมี drinkIds แล้วบังคับ
          // legacy strings (เก็บไว้ให้ report/export เดิม)
          addons: Array.isArray(editAddons) ? editAddons : [],
          drink: editDrink || "",
          note: cleanedNote,
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
        alert(out.error || "บันทึกไม่สำเร็จ");
        setSavingEdit(false);
        return;
      }

      // R2b: คูปอง + วันนี้ + ยังไม่ถึงเวลาปิด (dayFinalClosed มาจาก server ตาม lunchTimes)
      //      + ยังไม่มีออเดอร์ live -> เสนอ "ออก QR ทันที" (ไม่ออกให้เอง)
      if (
        editChoiceType === "coupon" &&
        !!todayYMD &&
        reportYMD === todayYMD &&
        !row.dayFinalClosed &&
        !row.orderId
      ) {
        setSavingEdit(false);
        setSavedCoupon(true);
        return;
      }

      await onSaved();
      return;
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    }
    setSavingEdit(false);
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
      <Modal open title={`แก้ไขอาหาร: ${row?.studentName || ""}`} onClose={() => onSaved()}>
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

  return (
    <Modal open title={`แก้ไขอาหาร: ${row?.studentName || ""}`} onClose={onClose}>
      <div className="space-y-4">
        {/* C5c: ข้อมูลคูปองของวันนี้ (อ่านอย่างเดียว) — ออเดอร์คูปองจัดการใน lunch flow */}
        {rowType(row) === "coupon" && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-[12px] text-admin-text">
            <div className="text-[11px] font-semibold text-violet-800">คูปองวันนี้</div>
            <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <span className="text-admin-textMuted">ร้าน</span>
              <span>{couponRestaurantName(row) || "-"}</span>
              <span className="text-admin-textMuted">สถานะ</span>
              <span>{couponStateText(row)}</span>
              <span className="text-admin-textMuted">Code</span>
              <span className="font-mono">
                {row.code ? `${sourceBadge(row)} · ${row.code}` : "-"}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-admin-textMuted">
              ออเดอร์คูปองจัดการในหน้าติดตามการสั่งอาหาร — การแก้ไขที่นี่ไม่สร้างออเดอร์หรือ QR
            </div>
          </div>
        )}

        {/* Choice type */}
        <div className="rounded-xl border border-admin-border bg-admin-surfaceMuted p-3">
          <div className="text-[11px] font-semibold text-admin-text">สถานะ</div>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {[
              ["food", "อาหาร"],
              ["coupon", "COUPON"],
              ["noFood", "ไม่รับอาหาร"],
            ].map(([value, label]) => (
              <label key={value} className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="choiceType"
                  checked={editChoiceType === value}
                  onChange={() => switchEditChoiceType(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Food selectors */}
        {editChoiceType === "food" && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-[11px] text-admin-textMuted">ร้านอาหาร</div>
              <select
                className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-2 text-sm"
                value={editRestaurantId}
                onChange={(e) => {
                  setEditRestaurantId(e.target.value);
                  setEditMenuId("");
                  setEditAddons([]);
                  setEditDrink("");
                }}
              >
                <option value="">{optLoading ? "กำลังโหลด..." : "เลือกร้าน"}</option>
                {foodOptions.map((r) => (
                  <option key={String(r.id)} value={String(r.id)}>
                    {r.name}
                  </option>
                ))}
              </select>
              {!foodOptions.length && !optLoading && (
                <div className="mt-1 text-[11px] text-admin-textMuted">
                  * ถ้าร้านไม่ขึ้น ลองปิด-เปิด modal หรือกดแก้ไขอีกครั้ง
                </div>
              )}
            </div>

            <div>
              <div className="text-[11px] text-admin-textMuted">เมนู</div>
              <select
                className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-2 text-sm"
                value={editMenuId}
                onChange={(e) => {
                  setEditMenuId(e.target.value);
                  setEditAddons([]);
                  setEditDrink("");
                }}
                disabled={!currentRestaurant}
              >
                <option value="">{currentRestaurant ? "เลือกเมนู" : "เลือกร้านก่อน"}</option>
                {(currentRestaurant?.menus || []).map((m) => (
                  <option key={String(m.id)} value={String(m.id)}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <div className="text-[11px] text-admin-textMuted">Add-on</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {currentAddonChoices.map((a) => {
                  const checked = editAddons.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggleAddon(a)}
                      className={cx(
                        "rounded-full border px-3 py-1 text-[12px]",
                        checked
                          ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                          : "border-admin-border bg-white text-admin-text",
                      )}
                    >
                      {a}
                    </button>
                  );
                })}
                {currentAddonChoices.length === 0 && (
                  <div className="text-[11px] text-admin-textMuted">
                    {editMenuId ? "ไม่มี Add-on" : "เลือกเมนูก่อน"}
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="text-[11px] text-admin-textMuted">เครื่องดื่ม</div>
              <select
                className="mt-1 w-full rounded-lg border border-admin-border bg-white px-3 py-2 text-sm"
                value={editDrink}
                onChange={(e) => setEditDrink(e.target.value)}
                disabled={!editMenuId}
              >
                <option value="">{editMenuId ? "เลือกเครื่องดื่ม (ถ้ามี)" : "เลือกเมนูก่อน"}</option>
                {currentDrinkChoices.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <div className="text-[11px] text-admin-textMuted">หมายเหตุ</div>
          <textarea
            className="mt-1 w-full rounded-lg border border-admin-border bg-white px-3 py-2 text-sm"
            rows={3}
            placeholder="เช่น แพ้อาหาร / ไม่ใส่ผัก / ฯลฯ"
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-admin-border bg-white px-3 py-2 text-sm hover:bg-admin-surfaceMuted"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={saveEdit}
            disabled={savingEdit || (editChoiceType === "food" && (!editRestaurantId || !editMenuId))}
            className={cx(
              "rounded-xl px-4 py-2 text-sm font-semibold",
              savingEdit
                ? "bg-admin-border text-admin-textMuted"
                : "bg-brand-primary text-white hover:opacity-90",
            )}
          >
            {savingEdit ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
