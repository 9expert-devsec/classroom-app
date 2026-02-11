// src/app/classroom/checkin/food/CheckinFoodClient.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import StepHeader from "../StepHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { useRouter } from "next/navigation";
import Image from "next/image";

import RestaurantCard from "./RestaurantCard";
import MenuCard from "./MenuCard";

function pick(sp, key) {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function safeReturnTo(path, fallback) {
  const s = String(path || "").trim();
  if (!s) return fallback;
  // allow only same-origin relative paths
  if (s.startsWith("/")) return s;
  return fallback;
}

/** choiceType:
 *  ""        = ยังไม่เลือกอะไร
 *  "noFood"  = ไม่รับอาหาร (ไปต่อได้เลย)
 *  "coupon"  = Coupon (ไปต่อได้เลย)
 *  "food"    = เลือกร้าน/เมนู
 */

function QuickChoiceCard({
  title,
  subtitle,
  icon,
  active,
  onClick,
  className = "",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex items-center justify-between rounded-2xl border px-4 py-4 text-left shadow-sm transition",
        active
          ? "border-brand-primary bg-brand-primary/10"
          : "border-brand-border bg-white hover:bg-front-bgSoft",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cx(
            "flex h-10 w-10 items-center justify-center rounded-2xl",
            active
              ? "bg-brand-primary text-white"
              : "bg-front-bgSoft text-front-text",
          )}
        >
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-front-text">{title}</div>
          <div className="text-xs text-front-textMuted">{subtitle}</div>
        </div>
      </div>

      <div
        className={cx(
          "h-5 w-5 rounded-full border-2",
          active
            ? "border-brand-primary bg-brand-primary"
            : "border-brand-border bg-white",
        )}
      />
    </button>
  );
}

function AddonCard({ item, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex items-center gap-3 rounded-2xl border bg-white px-3 py-2 text-left shadow-sm transition",
        active
          ? "border-brand-primary bg-brand-primary/10"
          : "border-brand-border hover:bg-front-bgSoft",
      )}
    >
      <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-front-bgSoft">
        {item?.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name || "addon"}
            fill
            sizes="40px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-front-textMuted">
            +
          </div>
        )}
      </div>

      <div className="flex-1">
        <div className="text-sm font-semibold text-front-text">
          {item?.name || "-"}
        </div>
      </div>

      <div
        className={cx(
          "h-5 w-5 rounded-full border-2",
          active
            ? "border-brand-primary bg-brand-primary"
            : "border-brand-border bg-white",
        )}
      />
    </button>
  );
}

function DrinkCard2({ item, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex items-center gap-3 rounded-2xl border bg-white px-3 py-2 text-left shadow-sm transition",
        active
          ? "border-brand-primary bg-brand-primary/10"
          : "border-brand-border hover:bg-front-bgSoft",
      )}
    >
      <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-front-bgSoft">
        {item?.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name || "drink"}
            fill
            sizes="40px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-front-textMuted">
            🥤
          </div>
        )}
      </div>

      <div className="flex-1">
        <div className="text-sm font-semibold text-front-text">
          {item?.name || "-"}
        </div>
      </div>

      <div
        className={cx(
          "h-5 w-5 rounded-full border-2",
          active
            ? "border-brand-primary bg-brand-primary"
            : "border-brand-border bg-white",
        )}
      />
    </button>
  );
}

export default function CheckinFoodClient({ searchParams = {} }) {
  const router = useRouter();

  const studentId =
    pick(searchParams, "studentId") || pick(searchParams, "sid");
  const classId =
    pick(searchParams, "classId") || pick(searchParams, "classid");
  const day = Number(pick(searchParams, "day") || 1);

  const isEdit =
    String(pick(searchParams, "edit") || "") === "1" ||
    String(pick(searchParams, "mode") || "") === "edit" ||
    String(pick(searchParams, "from") || "") === "edit-user";

  const returnToDefault = `/classroom/edit-user?day=${day}`;
  const returnTo = safeReturnTo(
    pick(searchParams, "returnTo") || pick(searchParams, "back") || "",
    returnToDefault,
  );

  const [restaurants, setRestaurants] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState(null);

  const [addonIds, setAddonIds] = useState([]);
  const [drinkId, setDrinkId] = useState("");

  // ✅ หมายเหตุ
  const [note, setNote] = useState("");

  // ✅ โหมด note: auto = ระบบตั้งค่าให้ / manual = user พิมพ์เองแล้ว ห้ามทับ
  const [noteMode, setNoteMode] = useState("auto");

  const [submitting, setSubmitting] = useState(false);
  const [hasFoodSetup, setHasFoodSetup] = useState(true);

  // ✅ ไม่ default เลือกอะไร
  const [choiceType, setChoiceType] = useState("");

  // กัน prefill ซ้ำแล้วไปทับการแก้ของ user
  const didPrefillRef = useRef(false);

  function resetFoodSelection() {
    setRestaurant(null);
    setMenu(null);
    setAddonIds([]);
    setDrinkId("");
  }

  function setNoteAuto(nextText) {
    // ถ้า user พิมพ์เอง (manual) → ไม่ทับ
    if (noteMode === "manual") return;
    setNote(String(nextText || ""));
    setNoteMode("auto");
  }

  function chooseNoFood() {
    setChoiceType("noFood");
    resetFoodSelection();
    setNoteAuto("ไม่รับอาหาร");
  }

  function chooseCoupon() {
    setChoiceType("coupon");
    resetFoodSelection();
    setNoteAuto("COUPON");
  }

  function chooseRestaurant(r) {
    setChoiceType("food");
    setRestaurant(null);
    setMenu(null);
    setAddonIds([]);
    setDrinkId("");

    // ✅ เลือกร้าน = เริ่ม note ใหม่ (วันใหม่ไม่ควรดึง note เก่า)
    setNote("");
    setNoteMode("auto");

    setTimeout(
      () =>
        setRestaurant({
          id: r.id,
          name: r.name,
          logo: r.logoUrl,
          menus: r.menus || [],
          addons: r.addons || [], // master list ต่อร้าน
          drinks: r.drinks || [], // master list ต่อร้าน
        }),
      80,
    );
  }

  function toggleAddonId(id) {
    setAddonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function applyPrefill(currentFood, items) {
    if (!currentFood) return;

    const cf = currentFood || {};
    const cfChoice = String(cf.choiceType || "");
    const cfNote = String(cf.note || "");
    const cfNoFood = !!cf.noFood;

    // ✅ prefill ถือว่าเป็น "auto" (user ยังไม่ได้พิมพ์)
    setNoteMode("auto");

    // noFood/coupon
    if (cfChoice === "noFood" || cfNoFood) {
      setChoiceType("noFood");
      resetFoodSelection();
      setNote(cfNote.trim() || "ไม่รับอาหาร");
      return;
    }
    if (cfChoice === "coupon") {
      setChoiceType("coupon");
      resetFoodSelection();
      setNote(cfNote.trim() || "COUPON");
      return;
    }

    // food
    if (cfChoice === "food") {
      setChoiceType("food");
      setNote(cfNote || "");

      const restId = String(cf.restaurantId || "");
      const menuId = String(cf.menuId || "");
      const addonIdList = Array.isArray(cf.addonIds)
        ? cf.addonIds.map((x) => String(x))
        : [];
      const dId = String(cf.drinkId || "");

      const foundRest = (items || []).find((r) => String(r.id) === restId);

      if (!foundRest) {
        // ร้านเดิมไม่อยู่ในตัวเลือกวันนี้ -> ให้ user เลือกใหม่
        resetFoodSelection();
        return;
      }

      const restObj = {
        id: foundRest.id,
        name: foundRest.name,
        logo: foundRest.logoUrl,
        menus: foundRest.menus || [],
        addons: foundRest.addons || [],
        drinks: foundRest.drinks || [],
      };
      setRestaurant(restObj);

      const foundMenu = (restObj.menus || []).find(
        (m) => String(m.id) === menuId,
      );
      if (!foundMenu) {
        setMenu(null);
        setAddonIds([]);
        setDrinkId("");
        return;
      }

      const menuObj = {
        id: foundMenu.id,
        name: foundMenu.name,
        addonIds: (foundMenu.addonIds || []).map(String),
        drinkIds: (foundMenu.drinkIds || []).map(String),
      };
      setMenu(menuObj);

      // filter ให้เหลือเฉพาะที่อยู่ใน menu จริง
      const allowedAddon = new Set(menuObj.addonIds || []);
      const allowedDrink = new Set(menuObj.drinkIds || []);

      setAddonIds(addonIdList.filter((x) => allowedAddon.has(String(x))));
      setDrinkId(allowedDrink.has(String(dId)) ? String(dId) : "");
    }
  }

  useEffect(() => {
    // ✅ reset guard ทุกครั้งที่เปลี่ยน student/class/day/isEdit
    didPrefillRef.current = false;

    async function loadFood() {
      const params = new URLSearchParams();
      params.set("day", String(day));
      if (studentId) params.set("studentId", studentId);
      if (classId) params.set("classId", classId);

      try {
        const res = await fetch(`/api/food/today?${params.toString()}`);
        if (!res.ok) {
          const text = await res.text();
          console.error("food/today error:", res.status, text);
          setRestaurants([]);
          setHasFoodSetup(true);
          return;
        }

        const data = await res.json();
        setHasFoodSetup(
          typeof data?.hasFoodSetup === "boolean" ? data.hasFoodSetup : true,
        );
        setRestaurants(data.items || []);

        // ✅ POLICY:
        // - เช็คอินวันใหม่ = ไม่ prefill ค่าเก่า
        // - prefill เฉพาะ isEdit เท่านั้น
        if (isEdit && !didPrefillRef.current && data?.currentFood) {
          didPrefillRef.current = true;
          applyPrefill(data.currentFood, data.items || []);
        }
      } catch (e) {
        console.error("food/today fetch fail:", e);
        setRestaurants([]);
        setHasFoodSetup(true);
      }
    }

    loadFood();
  }, [studentId, classId, day, isEdit]);

  // ✅ ทำ map จาก master list ต่อร้าน
  const addonById = useMemo(() => {
    const list = restaurant?.addons || [];
    return new Map(list.map((a) => [String(a.id), a]));
  }, [restaurant]);

  const drinkById = useMemo(() => {
    const list = restaurant?.drinks || [];
    return new Map(list.map((d) => [String(d.id), d]));
  }, [restaurant]);

  // ✅ options “ตามเมนู” (ผูกจริง)
  const menuAddonOptions = useMemo(() => {
    const ids = (menu?.addonIds || []).map(String);
    return ids.map((id) => addonById.get(String(id))).filter(Boolean);
  }, [menu, addonById]);

  const menuDrinkOptions = useMemo(() => {
    const ids = (menu?.drinkIds || []).map(String);
    return ids.map((id) => drinkById.get(String(id))).filter(Boolean);
  }, [menu, drinkById]);

  const selectedAddons = useMemo(() => {
    return addonIds.map((id) => addonById.get(String(id))).filter(Boolean);
  }, [addonIds, addonById]);

  const selectedDrink = useMemo(() => {
    return drinkById.get(String(drinkId)) || null;
  }, [drinkId, drinkById]);

  // ✅ Drink required เฉพาะ “เมนูนี้” (ถ้ามี option)
  const drinkRequired = menuDrinkOptions.length > 0;

  const ready =
    choiceType === "noFood" ||
    choiceType === "coupon" ||
    (choiceType === "food" &&
      restaurant &&
      menu &&
      (!drinkRequired || !!drinkId));

  async function handleSubmit() {
    if (!studentId || !classId) {
      alert("ไม่พบข้อมูลผู้เรียนหรือ classId");
      return;
    }
    if (!ready) return;

    setSubmitting(true);

    try {
      const base = { studentId, day, classId };

      const payload =
        choiceType === "noFood"
          ? {
              ...base,
              choiceType: "noFood",
              noFood: true,
              restaurantId: "",
              menuId: "",
              addonIds: [],
              drinkId: "",
              note: String(note || "").trim() || "ไม่รับอาหาร",
            }
          : choiceType === "coupon"
            ? {
                ...base,
                choiceType: "coupon",
                coupon: true,
                noFood: true,
                restaurantId: "",
                menuId: "",
                addonIds: [],
                drinkId: "",
                note: String(note || "").trim() || "COUPON",
              }
            : {
                ...base,
                choiceType: "food",
                noFood: false,
                restaurantId: restaurant?.id || "",
                menuId: menu?.id || "",
                addonIds: addonIds,
                drinkId: drinkId || "",
                note: note || "",
              };

      const res = await fetch("/api/checkin/food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "save failed");
      }

      // ✅ edit mode: กลับหน้า edit-user
      if (isEdit) {
        router.push(returnTo);
      } else {
        router.push(
          `/classroom/checkin/sign?studentId=${studentId}&classId=${classId}&day=${day}`,
        );
      }
    } catch (err) {
      console.error(err);
      alert("บันทึกเมนูไม่สำเร็จ");
    }

    setSubmitting(false);
  }

  const backHref = isEdit ? returnTo : `/classroom/checkin?day=${day}`;
  const primaryLabel = isEdit ? "บันทึกเมนู" : "ไปต่อ → เซ็นชื่อ";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {submitting && (
        <div className="absolute inset-0 z-[50] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
        </div>
      )}

      <StepHeader currentStep={2} />
      <div className="flex min-h-0 flex-1 flex-col px-6 py-6">
        <h2 className="text-lg font-semibold">
          {isEdit ? "แก้ไขเมนูอาหาร" : "Step 2: เลือกเมนูอาหาร"}
        </h2>

        <div className=" min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-2 flex flex-col gap-2">
          {!hasFoodSetup ? (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                <QuickChoiceCard
                  title="ไม่รับอาหาร"
                  subtitle="เลือกแล้วสามารถบันทึกได้ทันที"
                  icon="🍽️"
                  active={choiceType === "noFood"}
                  onClick={chooseNoFood}
                />
                <QuickChoiceCard
                  title="Coupon"
                  subtitle="เลือกแล้วสามารถบันทึกได้ทันที"
                  icon="🎫"
                  active={choiceType === "coupon"}
                  onClick={chooseCoupon}
                />
              </div>

              <div className="animate-fadeIn">
                <h3 className="mb-2 text-sm font-medium text-front-textMuted">
                  หมายเหตุเพิ่มเติม
                </h3>
                <textarea
                  rows={3}
                  className="w-full rounded-2xl border border-brand-border bg-white px-3 py-2 text-sm text-front-text shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/60"
                  placeholder="เช่น ไม่รับอาหาร, Coupon, แพ้อาหาร ฯลฯ"
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setNoteMode("manual");
                  }}
                />
              </div>

              {/* <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push(backHref)}
                  className="flex-1 rounded-2xl border border-brand-border bg-white px-4 py-2 text-sm font-medium text-front-text hover:bg-front-bgSoft"
                >
                  ← ย้อนกลับ
                </button>

                <PrimaryButton
                  onClick={handleSubmit}
                  className="flex-1"
                  disabled={!ready || submitting}
                >
                  {primaryLabel}
                </PrimaryButton>
              </div> */}
            </div>
          ) : (
            <>
              <h3 className="mt-4 mb-2 text-sm font-medium text-front-textMuted">
                เลือกร้านอาหาร
              </h3>

              <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                <QuickChoiceCard
                  title="ไม่รับอาหาร"
                  subtitle="เลือกแล้วสามารถบันทึกได้ทันที"
                  icon="🍽️"
                  active={choiceType === "noFood"}
                  onClick={chooseNoFood}
                />
                <QuickChoiceCard
                  title="Coupon"
                  subtitle="เลือกแล้วสามารถบันทึกได้ทันที"
                  icon="🎫"
                  active={choiceType === "coupon"}
                  onClick={chooseCoupon}
                />

                {restaurants.map((r) => (
                  <RestaurantCard
                    key={r.id}
                    restaurant={{ id: r.id, name: r.name, logo: r.logoUrl }}
                    active={choiceType === "food" && restaurant?.id === r.id}
                    onClick={() => chooseRestaurant(r)}
                  />
                ))}

                {restaurants.length === 0 && (
                  <p className="col-span-2 text-sm text-front-textMuted">
                    วันนี้ไม่มีร้าน/เมนูที่เปิดให้เลือก (แต่สามารถเลือก
                    “ไม่รับอาหาร” หรือ “Coupon” แล้วบันทึกได้)
                  </p>
                )}
              </div>

              {/* เมนู */}
              {choiceType === "food" && restaurant && (
                <div className="animate-fadeIn">
                  <h3 className="mt-6 mb-2 text-sm font-medium text-front-textMuted">
                    เมนูจากร้าน {restaurant.name}
                  </h3>

                  <div className="space-y-3">
                    {restaurant.menus.map((m) => (
                      <MenuCard
                        key={m.id}
                        menu={{ id: m.id, name: m.name, image: m.imageUrl }}
                        active={menu?.id === m.id}
                        onClick={() => {
                          setMenu(null);
                          setAddonIds([]);
                          setDrinkId("");

                          setTimeout(
                            () =>
                              setMenu({
                                id: m.id,
                                name: m.name,
                                addonIds: (m.addonIds || []).map(String),
                                drinkIds: (m.drinkIds || []).map(String),
                              }),
                            80,
                          );
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Add-ons ตามเมนู */}
              {choiceType === "food" &&
                restaurant &&
                menu &&
                menuAddonOptions.length > 0 && (
                  <div className="animate-fadeIn">
                    <h3 className="mt-6 mb-2 text-sm font-medium text-front-textMuted">
                      ตัวเลือกเพิ่มเติม (Add-on)
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      {menuAddonOptions.map((a) => {
                        const id = String(a.id);
                        const active = addonIds.includes(id);
                        return (
                          <AddonCard
                            key={id}
                            item={a}
                            active={active}
                            onClick={() => toggleAddonId(id)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Drinks ตามเมนู */}
              {choiceType === "food" &&
                restaurant &&
                menu &&
                menuDrinkOptions.length > 0 && (
                  <div className="animate-fadeIn">
                    <h3 className="mt-6 mb-2 text-sm font-medium text-front-textMuted">
                      เครื่องดื่ม <span className="text-red-500">*</span>
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      {menuDrinkOptions.map((d) => {
                        const id = String(d.id);
                        return (
                          <DrinkCard2
                            key={id}
                            item={d}
                            active={String(drinkId) === id}
                            onClick={() => setDrinkId(id)}
                          />
                        );
                      })}
                    </div>

                    {drinkId && (
                      <button
                        type="button"
                        className="mt-2 text-xs text-front-textMuted underline"
                        onClick={() => setDrinkId("")}
                      >
                        ล้างการเลือกเครื่องดื่ม
                      </button>
                    )}

                    {!drinkId && (
                      <div className="mt-2 text-xs text-front-textMuted">
                        กรุณาเลือกเครื่องดื่ม 1 อย่าง
                      </div>
                    )}
                  </div>
                )}

              {/* หมายเหตุ */}
              <div className="mt-6 animate-fadeIn">
                <h3 className="mb-2 text-sm font-medium text-front-textMuted">
                  หมายเหตุเพิ่มเติม
                </h3>
                <textarea
                  rows={3}
                  className="w-full rounded-2xl border border-brand-border bg-white px-3 py-2 text-sm text-front-text shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/60"
                  placeholder="เช่น เผ็ดน้อย, ไม่ใส่ผัก ฯลฯ"
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setNoteMode("manual");
                  }}
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="flex-1 rounded-2xl border border-brand-border bg-white px-4 py-2 text-sm font-medium text-front-text hover:bg-front-bgSoft"
          >
            ← ย้อนกลับ
          </button>

          <PrimaryButton
            onClick={handleSubmit}
            className="flex-1"
            disabled={!ready || submitting}
          >
            {primaryLabel}
          </PrimaryButton>
        </div>
      </div>

      {/* <div className=" bottom-0 z-10 border-t border-brand-border bg-white/90 backdrop-blur px-6 py-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push(backHref)}
              className="flex-1 rounded-2xl border border-brand-border bg-white px-4 py-2 text-sm font-medium text-front-text hover:bg-front-bgSoft"
            >
              ← ย้อนกลับ
            </button>

            <PrimaryButton
              onClick={handleSubmit}
              className="flex-1"
              disabled={!ready || submitting}
            >
              {primaryLabel}
            </PrimaryButton>
          </div>
        </div> */}
    </div>
  );
}
