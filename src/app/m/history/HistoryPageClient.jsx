"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function clean(x) {
  return String(x ?? "").trim();
}

function formatNumber(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("th-TH").format(num);
}

function formatDateInput(date = new Date()) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateTH(value) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function formatDateTimeTH(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function subMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

function subYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() - years);
  return d;
}

function getPresetRange(preset) {
  const today = new Date();
  const end = formatDateInput(today);

  if (preset === "7d") {
    return {
      start: formatDateInput(addDays(today, -6)),
      end,
    };
  }

  if (preset === "1m") {
    return {
      start: formatDateInput(subMonths(today, 1)),
      end,
    };
  }

  if (preset === "1y") {
    return {
      start: formatDateInput(subYears(today, 1)),
      end,
    };
  }

  return {
    start: end,
    end,
  };
}

function pickPositive(...values) {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function pickNumber(...values) {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function getDayKey(it) {
  if (clean(it?.billDayYMD)) return clean(it.billDayYMD);
  if (clean(it?.dayYMD)) return clean(it.dayYMD);

  const d = new Date(it?.redeemedAt);
  if (!Number.isNaN(d.getTime())) return formatDateInput(d);

  return "unknown";
}

function getBillKey(it) {
  if (clean(it?.billCode)) return `bill:${clean(it.billCode)}`;
  return `coupon:${clean(it?.id || it?.displayCode || Math.random().toString(36).slice(2))}`;
}

function buildHistoryGroups(items) {
  const dayMap = new Map();

  for (const it of Array.isArray(items) ? items : []) {
    const dayKey = getDayKey(it);
    const billKey = getBillKey(it);

    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, {
        dayKey,
        billsMap: new Map(),
      });
    }

    const dayGroup = dayMap.get(dayKey);

    if (!dayGroup.billsMap.has(billKey)) {
      dayGroup.billsMap.set(billKey, {
        key: billKey,
        billCode: clean(it?.billCode),
        redeemedAt: it?.redeemedAt || null,
        courseName: clean(it?.courseName),
        holderName: clean(it?.holderName),
        couponCount: 0,
        couponTotal: 0,
        billTotal: 0,
        payMore: 0,
        items: [],
      });
    }

    const billGroup = dayGroup.billsMap.get(billKey);

    billGroup.items.push(it);

    if (!billGroup.redeemedAt && it?.redeemedAt) {
      billGroup.redeemedAt = it.redeemedAt;
    }

    billGroup.courseName = billGroup.courseName || clean(it?.courseName);
    billGroup.holderName = billGroup.holderName || clean(it?.holderName);

    billGroup.couponCount = pickPositive(
      it?.billCouponCount,
      billGroup.couponCount,
      billGroup.items.length,
    );

    billGroup.couponTotal = pickPositive(
      it?.billCouponTotal,
      billGroup.couponTotal,
      billGroup.items.reduce(
        (sum, row) => sum + pickNumber(row?.couponPrice, 180),
        0,
      ),
    );

    billGroup.billTotal = pickPositive(
      it?.billTotal,
      billGroup.billTotal,
      it?.spentAmount,
    );

    billGroup.payMore = pickNumber(
      it?.billPayMore,
      billGroup.payMore,
      it?.diffAmount,
    );
  }

  const days = Array.from(dayMap.values())
    .map((dayGroup) => {
      const bills = Array.from(dayGroup.billsMap.values())
        .map((bill) => {
          const fallbackCouponCount = bill.items.length;
          const fallbackCouponTotal = bill.items.reduce(
            (sum, row) => sum + pickNumber(row?.couponPrice, 180),
            0,
          );

          const fallbackBillTotal = bill.items.reduce(
            (sum, row) => sum + pickNumber(row?.spentAmount, 0),
            0,
          );

          const fallbackPayMore = bill.items.reduce(
            (sum, row) => sum + pickNumber(row?.diffAmount, 0),
            0,
          );

          return {
            ...bill,
            couponCount: bill.couponCount || fallbackCouponCount,
            couponTotal: bill.couponTotal || fallbackCouponTotal,
            billTotal: bill.billTotal || fallbackBillTotal,
            payMore: bill.billCode
              ? bill.payMore
              : fallbackPayMore,
            items: [...bill.items].sort((a, b) => {
              const at = new Date(a?.redeemedAt || 0).getTime();
              const bt = new Date(b?.redeemedAt || 0).getTime();
              return bt - at;
            }),
          };
        })
        .sort((a, b) => {
          const at = new Date(a?.redeemedAt || 0).getTime();
          const bt = new Date(b?.redeemedAt || 0).getTime();
          return bt - at;
        });

      return {
        dayKey: dayGroup.dayKey,
        bills,
      };
    })
    .sort((a, b) => {
      if (a.dayKey === "unknown") return 1;
      if (b.dayKey === "unknown") return -1;
      return a.dayKey < b.dayKey ? 1 : -1;
    });

  return days;
}

export default function HistoryPageClient() {
  const router = useRouter();

  const initialRange = useMemo(() => getPresetRange("7d"), []);
  const [preset, setPreset] = useState("7d");
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState({
    usedCount: 0,
    couponAmount: 0,
    totalAmount: 0,
  });

  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      if (!startDate || !endDate) return;

      try {
        setLoading(true);
        setError("");

        const sp = new URLSearchParams({
          start: startDate,
          end: endDate,
        });

        const res = await fetch(`/api/merchant/history?${sp.toString()}`, {
          cache: "no-store",
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "LOAD_HISTORY_FAILED");
        }

        if (cancelled) return;

        setSummary({
          usedCount: json?.summary?.usedCount || 0,
          couponAmount: json?.summary?.couponAmount || 0,
          totalAmount: json?.summary?.totalAmount || 0,
        });

        setItems(Array.isArray(json?.items) ? json.items : []);
      } catch (err) {
        if (cancelled) return;

        setSummary({
          usedCount: 0,
          couponAmount: 0,
          totalAmount: 0,
        });
        setItems([]);
        setError("โหลดข้อมูลไม่สำเร็จ");
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  const groupedDays = useMemo(() => buildHistoryGroups(items), [items]);

  function applyPreset(nextPreset) {
    const range = getPresetRange(nextPreset);
    setPreset(nextPreset);
    setStartDate(range.start);
    setEndDate(range.end);
  }

  function onChangeStart(value) {
    setPreset("custom");
    setStartDate(value);
    if (endDate && value && value > endDate) {
      setEndDate(value);
    }
  }

  function onChangeEnd(value) {
    setPreset("custom");
    setEndDate(value);
    if (startDate && value && value < startDate) {
      setStartDate(value);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#F6F8FC] text-slate-900">
      <div className="h-24 shrink-0 bg-gradient-to-r from-[#2B6CFF] via-[#66CCFF] to-[#F6B73C]" />

      <div className="-mt-14 flex min-h-[calc(100dvh-6rem)] flex-col px-4 pb-10">
        <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-bold">ประวัติการใช้งานคูปอง</div>
                <div className="mt-1 text-sm text-slate-500">
                  เลือกช่วงวันที่เพื่อดูรายการย้อนหลัง
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push("/m/dashboard")}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                กลับ
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { key: "7d", label: "7 วันย้อนหลัง" },
                { key: "1m", label: "1 เดือนย้อนหลัง" },
                { key: "1y", label: "1 ปีย้อนหลัง" },
                { key: "custom", label: "กำหนดเอง" },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    if (p.key === "custom") {
                      setPreset("custom");
                      return;
                    }
                    applyPreset(p.key);
                  }}
                  className={
                    preset === p.key
                      ? "rounded-2xl bg-[#2B6CFF] px-4 py-2 text-sm font-semibold text-white"
                      : "rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="history-start" className="text-sm text-slate-500">
                  วันที่เริ่ม
                </label>
                <input
                  id="history-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => onChangeStart(e.target.value)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-3 outline-none focus:border-[#66CCFF] focus:ring-2 focus:ring-[#66CCFF]/50"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="history-end" className="text-sm text-slate-500">
                  วันที่สิ้นสุด
                </label>
                <input
                  id="history-end"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => onChangeEnd(e.target.value)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-3 outline-none focus:border-[#66CCFF] focus:ring-2 focus:ring-[#66CCFF]/50"
                />
              </div>
            </div>

            <div className="mt-3 text-sm text-slate-500">
              ช่วงที่เลือก:{" "}
              <span className="font-semibold text-slate-700">
                {formatDateTH(startDate)}
              </span>{" "}
              →{" "}
              <span className="font-semibold text-slate-700">
                {formatDateTH(endDate)}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-base font-bold">สรุปช่วงวันที่เลือก</div>

            <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200">
              <div className="px-2 text-center">
                <div className="text-sm text-slate-500">จำนวนคูปองที่ใช้</div>
                <div className="mt-2 text-xl font-bold text-slate-900">
                  {formatNumber(summary.usedCount)}
                </div>
                <div className="text-sm text-slate-400">คูปอง</div>
              </div>

              <div className="px-2 text-center">
                <div className="text-sm text-slate-500">ยอดเงินจากคูปอง</div>
                <div className="mt-2 text-xl font-bold text-slate-900">
                  {formatNumber(summary.couponAmount)}
                </div>
                <div className="text-sm text-slate-400">บาท</div>
              </div>

              <div className="px-2 text-center">
                <div className="text-sm text-slate-500">ยอดรวม</div>
                <div className="mt-2 text-xl font-bold text-slate-900">
                  {formatNumber(summary.totalAmount)}
                </div>
                <div className="text-sm text-slate-400">บาท</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-bold">รายการใช้งาน</div>
              {!loading && !error ? (
                <div className="text-xs text-slate-500">
                  {groupedDays.length > 0
                    ? `${groupedDays.length} วัน`
                    : "ไม่มีข้อมูล"}
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : loading ? (
              <div className="mt-4 space-y-2">
                <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
                <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
                <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
              </div>
            ) : groupedDays.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                ไม่พบรายการใช้งานในช่วงวันที่เลือก
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                {groupedDays.map((day) => (
                  <div key={day.dayKey} className="space-y-2">
                    <div className="sticky top-0 z-[1] rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                      {day.dayKey === "unknown"
                        ? "ไม่ทราบวันที่"
                        : formatDateTH(day.dayKey)}
                    </div>

                    <div className="space-y-2">
                      {day.bills.map((bill) => (
                        <div
                          key={bill.key}
                          className="rounded-2xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-bold break-all">
                                {bill.billCode
                                  ? `${bill.billCode}`
                                  : `Ref. ${bill.items?.[0]?.displayCode || "-"}`}
                              </div>

                              <div className="mt-1 truncate text-xs text-slate-600">
                                {bill.courseName || "-"}
                              </div>

                              <div className="mt-1 text-xs text-slate-500">
                                {formatDateTimeTH(bill.redeemedAt)}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                                  {formatNumber(bill.couponCount)} คูปอง
                                </span>
                                <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                                  คูปองรวม {formatNumber(bill.couponTotal)}฿
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <div className="text-xs text-slate-500">
                                ยอดจริง
                              </div>
                              <div className="font-bold">
                                {formatNumber(bill.billTotal)}฿
                              </div>

                              <div className="mt-1 text-xs text-slate-500">
                                ส่วนต่าง{" "}
                                <span
                                  className={
                                    Number(bill.payMore) > 0
                                      ? "font-semibold text-red-600"
                                      : "font-semibold text-emerald-700"
                                  }
                                >
                                  {Number(bill.payMore) > 0 ? "+" : ""}
                                  {formatNumber(bill.payMore)}฿
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                            <div className="text-xs text-slate-500 truncate">
                              {bill.items
                                .map((it) => clean(it?.displayCode))
                                .filter(Boolean)
                                .slice(0, 4)
                                .join(" • ")}
                              {bill.items.length > 4 ? " ..." : ""}
                            </div>

                            <button
                              type="button"
                              className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold hover:bg-slate-100"
                              onClick={() => {
                                if (bill.billCode) {
                                  router.push(
                                    `/m/redeem?bill=${encodeURIComponent(bill.billCode)}`,
                                  );
                                  return;
                                }

                                const first = bill.items?.[0];
                                if (first?.redeemCipher) {
                                  router.push(
                                    `/m/redeem?c=${encodeURIComponent(first.redeemCipher)}`,
                                  );
                                }
                              }}
                            >
                              ดูรายละเอียด
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-center text-xs text-slate-500">
            © 9Expert Training
          </div>
        </div>
      </div>
    </div>
  );
}