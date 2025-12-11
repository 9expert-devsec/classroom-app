// src/app/admin/classroom/food/calendar/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import PrimaryButton from "@/components/ui/PrimaryButton";
import Image from "next/image";

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function formatMonthYear(date) {
  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
  });
}

const WEEKDAYS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

export default function FoodCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() =>
    startOfMonth(new Date())
  );
  const [restaurants, setRestaurants] = useState([]);
  const [dayConfigs, setDayConfigs] = useState([]); // [{ date, items: [{ restaurant, set }] }]
  const [selectedDate, setSelectedDate] = useState(null);

  // [{ restaurantId, setId }]
  const [selectedItems, setSelectedItems] = useState([]);

  const [saving, setSaving] = useState(false);

  // map restaurantId -> array of sets
  const [restaurantSets, setRestaurantSets] = useState({});

  const monthKey = useMemo(() => {
    return `${currentMonth.getFullYear()}-${String(
      currentMonth.getMonth() + 1
    ).padStart(2, "0")}`;
  }, [currentMonth]);

  /* ---------- โหลดร้าน + ชุดเมนูของแต่ละร้าน ---------- */
  useEffect(() => {
    async function loadRestaurantsAndSets() {
      const res = await fetch("/api/admin/food/restaurants");
      const data = await res.json();
      const items = data.items || [];
      setRestaurants(items);

      // โหลด sets ของแต่ละร้าน (ง่ายสุด ยิงทีละร้าน)
      const setsMap = {};
      await Promise.all(
        items.map(async (r) => {
          try {
            const sRes = await fetch(
              `/api/admin/food/sets?restaurantId=${encodeURIComponent(r._id)}`
            );
            const sData = await sRes.json();
            setsMap[r._id] = sData.items || [];
          } catch (e) {
            console.error("load sets error for restaurant", r._id, e);
            setsMap[r._id] = [];
          }
        })
      );
      setRestaurantSets(setsMap);
    }
    loadRestaurantsAndSets();
  }, []);

  /* ---------- โหลด config ของเดือน (วันไหนใช้ร้านอะไร+Setอะไร) ---------- */
  useEffect(() => {
    async function loadDayConfigs() {
      const res = await fetch(`/api/admin/food/days?month=${monthKey}`);
      const data = await res.json();
      setDayConfigs(data.items || []);
    }
    loadDayConfigs();
  }, [monthKey]);

  // สร้าง grid วันในเดือน
  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const firstWeekday = (start.getDay() + 6) % 7; // แปลง Sun=0 เป็น จ=0
    const daysInMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0
    ).getDate();

    const slots = [];
    for (let i = 0; i < firstWeekday; i++) {
      slots.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        d
      );
      slots.push(date);
    }
    return slots;
  }, [currentMonth]);

  function getConfigFor(date) {
    if (!date) return null;
    const key = new Date(date);
    key.setHours(0, 0, 0, 0);
    return dayConfigs.find((c) => {
      const d = new Date(c.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === key.getTime();
    });
  }

  function onSelectDate(date) {
    setSelectedDate(date);
    const cfg = getConfigFor(date);

    if (cfg?.items?.length) {
      // รองรับทั้งกรณี populate และเก็บแค่ id
      const mapped = cfg.items.map((item) => ({
        restaurantId:
          typeof item.restaurant === "string"
            ? item.restaurant
            : String(item.restaurant?._id),
        setId:
          typeof item.set === "string"
            ? item.set
            : item.set?._id
            ? String(item.set._id)
            : "",
      }));
      setSelectedItems(mapped);
    } else if (cfg?.restaurants?.length) {
      // กรณีโครงสร้างเก่า (มีแต่ restaurants)
      const mapped = cfg.restaurants.map((r) => ({
        restaurantId: typeof r === "string" ? r : String(r._id),
        setId: "",
      }));
      setSelectedItems(mapped);
    } else {
      setSelectedItems([]);
    }
  }

  function isRestaurantChecked(id) {
    return selectedItems.some((it) => it.restaurantId === id);
  }

  function toggleRestaurant(id) {
    setSelectedItems((prev) => {
      const exists = prev.some((it) => it.restaurantId === id);
      if (exists) {
        return prev.filter((it) => it.restaurantId !== id);
      }
      return [...prev, { restaurantId: id, setId: "" }];
    });
  }

  function changeSetForRestaurant(restId, setId) {
    setSelectedItems((prev) =>
      prev.map((it) =>
        it.restaurantId === restId ? { ...it, setId } : it
      )
    );
  }

  async function saveDayConfig() {
    if (!selectedDate) return;
    setSaving(true);

    try {
      // YYYY-MM-DD แบบ local time
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const dd = String(selectedDate.getDate()).padStart(2, "0");
      const iso = `${yyyy}-${mm}-${dd}`;

      await fetch("/api/admin/food/days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: iso,
          items: selectedItems.map((it) => ({
            restaurantId: it.restaurantId,
            setId: it.setId || null,
          })),
        }),
      });

      // reload หลังบันทึก
      const res = await fetch(`/api/admin/food/days?month=${monthKey}`);
      const data = await res.json();
      setDayConfigs(data.items || []);
    } catch (err) {
      console.error(err);
      alert("บันทึกไม่สำเร็จ");
    }

    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Food Calendar</h1>
        <p className="text-sm text-admin-textMuted">
          กำหนดว่าทุก ๆ วัน จะให้ผู้เรียนเลือกได้จากร้านใดบ้าง และใช้ชุดเมนูใด
        </p>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between rounded-2xl bg-admin-surface p-4 shadow-card">
        <button
          className="rounded-full border border-admin-border px-3 py-1 text-sm text-admin-textMuted hover:bg-admin-surfaceMuted"
          onClick={() => setCurrentMonth((d) => addMonths(d, -1))}
        >
          ← เดือนก่อนหน้า
        </button>
        <div className="text-sm font-medium">
          {formatMonthYear(currentMonth)}
        </div>
        <button
          className="rounded-full border border-admin-border px-3 py-1 text-sm text-admin-textMuted hover:bg-admin-surfaceMuted"
          onClick={() => setCurrentMonth((d) => addMonths(d, 1))}
        >
          เดือนถัดไป →
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid gap-4 lg:grid-cols-[3fr,2fr]">
        <div className="rounded-2xl bg-admin-surface p-4 shadow-card">
          <div className="grid grid-cols-7 text-center text-xs font-medium text-admin-textMuted">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1 text-xs">
            {days.map((date, idx) => {
              if (!date) return <div key={idx} />;

              const cfg = getConfigFor(date);
              const selected =
                selectedDate &&
                date.toDateString() === selectedDate.toDateString();

              const count =
                cfg?.items?.length ??
                cfg?.restaurants?.length ??
                0;

              return (
                <button
                  key={idx}
                  onClick={() => onSelectDate(date)}
                  className={
                    "flex flex-col rounded-xl border px-1.5 py-1.5 text-left transition " +
                    (selected
                      ? "border-brand-primary bg-admin-surfaceMuted"
                      : "border-admin-border bg-white hover:bg-admin-surfaceMuted/70")
                  }
                >
                  <span className="text-[11px] font-medium">
                    {date.getDate()}
                  </span>
                  {count > 0 && (
                    <span className="mt-0.5 rounded-full bg-brand-primary/10 px-1 text-[10px] text-brand-primary">
                      {count} ร้าน
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right side: restaurants + set selector */}
        <div className="rounded-2xl bg-admin-surface p-4 shadow-card">
          <h2 className="text-sm font-semibold">กำหนดร้านและชุดเมนูสำหรับวัน</h2>
          <p className="mt-1 text-xs text-admin-textMuted">
            เลือกวันจาก Calendar ด้านซ้าย แล้วเลือกร้าน + Set ที่จะใช้ในวันนั้น
          </p>

          <div className="mt-3 text-sm">
            {selectedDate ? (
              <div className="mb-2 text-admin-text">
                วันที่{" "}
                {selectedDate.toLocaleDateString("th-TH", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            ) : (
              <div className="mb-2 text-admin-textMuted">
                ยังไม่ได้เลือกวันที่
              </div>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 text-sm">
            {restaurants.map((r) => {
              const checked = isRestaurantChecked(r._id);
              const sets = restaurantSets[r._id] || [];
              const selectedItem = selectedItems.find(
                (it) => it.restaurantId === r._id
              );
              const setId = selectedItem?.setId || "";

              return (
                <div
                  key={r._id}
                  className="flex items-center justify-between rounded-xl border border-admin-border bg-white px-3 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5"
                      checked={checked}
                      onChange={() => toggleRestaurant(r._id)}
                    />
                    <span>{r.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {checked && sets.length > 0 && (
                      <select
                        className="rounded-lg border border-admin-border bg-admin-surfaceMuted px-2 py-1 text-xs"
                        value={setId}
                        onChange={(e) =>
                          changeSetForRestaurant(r._id, e.target.value)
                        }
                      >
                        <option value="">-- เลือก Set --</option>
                        {sets.map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {r.logoUrl && (
                      <Image
                        src={r.logoUrl}
                        alt={r.name}
                        width={24}
                        height={24}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {restaurants.length === 0 && (
              <p className="text-xs text-admin-textMuted">
                ยังไม่มีร้านอาหาร ให้ไปเพิ่มในหน้า Food Menu ก่อน
              </p>
            )}
          </div>

          <PrimaryButton
            className="mt-3 w-full"
            onClick={saveDayConfig}
            disabled={!selectedDate || saving}
          >
            {saving ? "กำลังบันทึก..." : "บันทึกร้าน/Set สำหรับวันนี้"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
