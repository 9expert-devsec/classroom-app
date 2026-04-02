"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function formatNumber(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("th-TH").format(num);
}

function formatDateInput(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

export default function HistoryPageClient() {
  const router = useRouter();

  const [date, setDate] = useState(formatDateInput());
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
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/merchant/history?date=${date}`, {
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
  }, [date]);

  return (
    <div className="min-h-[100dvh] bg-[#F6F8FC] text-slate-900">
      <div className="h-24 shrink-0 bg-gradient-to-r from-[#2B6CFF] via-[#66CCFF] to-[#F6B73C]" />

      <div className="-mt-14 flex min-h-[calc(100dvh-6rem)] flex-col px-4 pb-10">
        <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-bold">ประวัติการใช้งานคูปอง</div>
                <div className="mt-1 text-sm text-slate-500">
                  เลือกวันที่เพื่อดูรายการใช้งานย้อนหลัง
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

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="history-date" className="text-sm text-slate-500">
                  วันที่
                </label>
                <input
                  id="history-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-3 outline-none focus:border-[#66CCFF] focus:ring-2 focus:ring-[#66CCFF]/50"
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-base font-bold">สรุปของวันที่เลือก</div>

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
            <div className="text-sm font-bold">รายการใช้งาน</div>

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
            ) : items.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                ไม่พบรายการใช้งานในวันที่เลือก
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {items.map((it) => (
                  <div
                    key={it.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold">
                          Ref. {it.displayCode || "-"}
                        </div>

                        <div className="mt-1 truncate text-xs text-slate-600">
                          {it.holderName || "-"} • {it.courseName || "-"}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {formatDateTimeTH(it.redeemedAt)}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-xs text-slate-500">ยอดจริง</div>
                        <div className="font-bold">
                          {formatNumber(it.spentAmount)}฿
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          ส่วนต่าง{" "}
                          <span
                            className={
                              Number(it.diffAmount) > 0
                                ? "font-semibold text-red-600"
                                : "font-semibold text-emerald-700"
                            }
                          >
                            {Number(it.diffAmount) > 0 ? "+" : ""}
                            {formatNumber(it.diffAmount)}฿
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold hover:bg-slate-100"
                        onClick={() => {
                          if (it.billCode) {
                            router.push(
                              `/m/redeem?bill=${encodeURIComponent(it.billCode)}`,
                            );
                            return;
                          }

                          if (it.redeemCipher) {
                            router.push(
                              `/m/redeem?c=${encodeURIComponent(it.redeemCipher)}`,
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