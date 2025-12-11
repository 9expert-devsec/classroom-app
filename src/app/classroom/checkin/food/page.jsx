// src/app/classroom/checkin/food/page.jsx
"use client";

import { useEffect, useState } from "react";
import StepHeader from "../StepHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { useSearchParams, useRouter } from "next/navigation";
import RestaurantCard from "./RestaurantCard";
import MenuCard from "./MenuCard";
import DrinkCard from "./DrinkCard";

export default function FoodPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const studentId = searchParams.get("studentId") || searchParams.get("sid");
  const classId = searchParams.get("classId") || searchParams.get("classid");
  const day = Number(searchParams.get("day") || 1);

  const [restaurants, setRestaurants] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState(null);
  const [addons, setAddons] = useState([]);
  const [drink, setDrink] = useState(null);
  const [note, setNote] = useState(""); // ✅ หมายเหตุเพิ่มเติม
  const [submitting, setSubmitting] = useState(false);

  // โหลดเมนูอาหารของ "วันนี้ (day ปัจจุบัน)"
  useEffect(() => {
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
          return;
        }

        const data = await res.json();
        setRestaurants(data.items || []);
      } catch (e) {
        console.error("food/today fetch fail:", e);
        setRestaurants([]);
      }
    }
    loadFood();
  }, [studentId, classId, day]);

  function toggleAddon(name) {
    if (addons.includes(name)) {
      setAddons(addons.filter((x) => x !== name));
    } else {
      setAddons([...addons, name]);
    }
  }

  async function handleSubmit() {
    if (!restaurant || !menu || !drink) return;
    if (!studentId || !classId) {
      alert("ไม่พบข้อมูลผู้เรียนหรือ classId");
      return;
    }

    setSubmitting(true);

    try {
      // บันทึกเมนูที่เลือก
      await fetch("/api/checkin/food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          restaurantId: restaurant.id,
          menuId: menu.id,
          addons,
          drink,
          note,
          day,
          classId,
        }),
      });

      // ไปหน้าเซ็นชื่อ พร้อมส่ง day ต่อไป
      router.push(
        `/classroom/checkin/sign?studentId=${studentId}&classId=${classId}&day=${day}`
      );
    } catch (err) {
      console.error(err);
      alert("บันทึกเมนูไม่สำเร็จ");
    }

    setSubmitting(false);
  }

  function handleBackToSearch() {
    // กลับไป Step 1 (ค้นหาชื่อ) พร้อมพา param เดิมกลับไป
    router.push(
      `/classroom/checkin?studentId=${studentId || ""}&classId=${
        classId || ""
      }&day=${day}`
    );
  }

  const ready = restaurant && menu && drink;

  return (
    <div className="relative flex flex-col">
      {submitting && (
        <div className="absolute inset-0 z-[50] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
        </div>
      )}

      <StepHeader currentStep={2} />

      <div className="px-6 py-6">
        <h2 className="text-lg font-semibold">Step 2: เลือกเมนูอาหาร</h2>

        {/* ร้านอาหาร */}
        <h3 className="mt-4 mb-2 text-sm font-medium text-front-textMuted">
          เลือกร้านอาหาร
        </h3>

        <div className="grid grid-cols-2 gap-3 animate-fadeIn">
          {restaurants.map((r) => (
            <RestaurantCard
              key={r.id}
              restaurant={{ id: r.id, name: r.name, logo: r.logoUrl }}
              active={restaurant?.id === r.id}
              onClick={() => {
                setRestaurant(null);
                setMenu(null);
                setAddons([]);
                setDrink(null);
                setNote("");
                setTimeout(
                  () =>
                    setRestaurant({
                      id: r.id,
                      name: r.name,
                      logo: r.logoUrl,
                      menus: r.menus,
                    }),
                  80
                );
              }}
            />
          ))}

          {restaurants.length === 0 && (
            <p className="col-span-2 text-sm text-front-textMuted">
              ยังไม่มีเมนูอาหารในวันนี้
            </p>
          )}
        </div>

        {/* เมนู */}
        {restaurant && (
          <div className="animate-fadeIn">
            <h3 className="mt-6 mb-2 text-sm font-medium text-front-textMuted">
              เมนูจากร้าน {restaurant.name}
            </h3>

            <div className="space-y-3">
              {restaurant.menus.map((m) => (
                <MenuCard
                  key={m.id}
                  menu={{
                    id: m.id,
                    name: m.name,
                    image: m.imageUrl,
                  }}
                  active={menu?.id === m.id}
                  onClick={() => {
                    setMenu(null);
                    setAddons([]);
                    setDrink(null);
                    setNote("");
                    setTimeout(
                      () =>
                        setMenu({
                          id: m.id,
                          name: m.name,
                          addons: m.addons,
                          drinks: m.drinks,
                        }),
                      80
                    );
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Addons */}
        {menu?.addons?.length > 0 && (
          <div className="animate-fadeIn">
            <h3 className="mt-6 mb-2 text-sm font-medium text-front-textMuted">
              ตัวเลือกเพิ่มเติม (Add-on)
            </h3>

            <div className="flex flex-wrap gap-2">
              {menu.addons.map((ad) => (
                <button
                  key={ad}
                  onClick={() => toggleAddon(ad)}
                  className={`rounded-xl border px-3 py-1 text-sm transition ${
                    addons.includes(ad)
                      ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                      : "bg-white text-front-text border-brand-border hover:bg-front-bgSoft"
                  }`}
                >
                  {ad}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Drinks */}
        {menu?.drinks?.length > 0 && (
          <div className="animate-fadeIn">
            <h3 className="mt-6 mb-2 text-sm font-medium text-front-textMuted">
              เครื่องดื่ม
            </h3>

            <div className="flex flex-wrap gap-2">
              {menu.drinks.map((dr) => (
                <DrinkCard
                  key={dr}
                  drink={dr}
                  active={drink === dr}
                  onClick={() => setDrink(dr)}
                />
              ))}
            </div>
          </div>
        )}

        {/* หมายเหตุเพิ่มเติม */}
        <div className="mt-6 animate-fadeIn">
          <h3 className="mb-2 text-sm font-medium text-front-textMuted">
            หมายเหตุเพิ่มเติม
          </h3>
          <textarea
            rows={3}
            className="w-full rounded-2xl border border-brand-border bg-white px-3 py-2 text-sm text-front-text shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/60"
            placeholder="เช่น เผ็ดน้อย, ไม่ใส่ผัก, แยกน้ำจิ้ม ฯลฯ (ถ้าไม่มีสามารถเว้นว่างได้)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* ปุ่ม Back + ไปต่อ */}
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() => router.push(`/classroom/checkin?day=${day}`)}
            className="flex-1 rounded-2xl border border-brand-border bg-white px-4 py-2 text-sm font-medium text-front-text hover:bg-front-bgSoft"
          >
            ← ย้อนกลับไปค้นหาชื่อ (Step 1)
          </button>

          <PrimaryButton
            onClick={handleSubmit}
            className="flex-1"
            disabled={!ready || submitting}
          >
            {ready ? "ไปต่อ → เซ็นชื่อ" : "กรุณาเลือกให้ครบ"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
