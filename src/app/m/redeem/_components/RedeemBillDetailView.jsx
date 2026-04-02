"use client";

import { useMemo } from "react";
import { ChevronLeft } from "lucide-react";

function clean(x) {
  return String(x ?? "").trim();
}

function fmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function fmtDateTimeTH(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

function toAmount(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function sortRowsForDisplay(rows) {
  const list = Array.isArray(rows) ? [...rows] : [];

  list.sort((a, b) => {
    const at = a?.item?.redeemedAt ? new Date(a.item.redeemedAt).getTime() : 0;
    const bt = b?.item?.redeemedAt ? new Date(b.item.redeemedAt).getTime() : 0;
    if (at !== bt) return at - bt;

    const ak = clean(a?.item?.displayCode || a?.key);
    const bk = clean(b?.item?.displayCode || b?.key);
    return ak.localeCompare(bk, "en");
  });

  return list;
}

function buildAppliedRows(rows, billTotal) {
  let remaining = Math.max(0, toAmount(billTotal, 0));

  return rows.map((r, index) => {
    const faceValue = Math.max(0, toAmount(r?.item?.couponPrice, 180));
    const appliedAmount = Math.max(0, Math.min(faceValue, remaining));
    remaining = Math.max(0, remaining - appliedAmount);

    return {
      ...r,
      _order: index + 1,
      _faceValue: faceValue,
      _appliedAmount: appliedAmount,
      _remainingAfter: remaining,
    };
  });
}

export default function RedeemBillDetailView({
  restaurantName,
  billCode,
  billMeta,
  rows,
  receipt,
  err,
  onBackDashboard,
}) {
  const billTotal = Math.max(0, toAmount(receipt?.billTotal, 0));

  const appliedRows = useMemo(() => {
    const ordered = sortRowsForDisplay(rows);
    return buildAppliedRows(ordered, billTotal);
  }, [rows, billTotal]);

  const actualCouponUsed = useMemo(() => {
    return appliedRows.reduce((sum, r) => sum + toAmount(r._appliedAmount, 0), 0);
  }, [appliedRows]);

  const couponCount = appliedRows.length;

  const payMore = Math.max(0, billTotal - actualCouponUsed);

  return (
    <>
      <div className="mt-3 flex items-start gap-3">
        <div className="shrink-0">
          <button
            className="rounded-full border border-slate-200 bg-white p-2 text-sm font-semibold hover:bg-slate-50"
            onClick={onBackDashboard}
          >
            <ChevronLeft />
          </button>
        </div>

        <div className="min-w-0">
          <div className="text-xs text-slate-500">ร้านค้า</div>
          <div className="text-sm font-bold">{restaurantName}</div>
          <div className="mt-0.5 break-all text-base text-slate-500">
            Bill:{" "}
            <span className="font-semibold text-slate-700">{billCode}</span>
          </div>

          {/* {billMeta ? (
            <div className="mt-1 text-xs text-slate-500">
              {billMeta.courseName || "-"} • {billMeta.roomName || "-"} •{" "}
              {billMeta.dayYMD || "-"}
            </div>
          ) : null} */}

          <div className="mt-1 text-sm text-slate-500">
            เวลา: {fmtDateTimeTH(receipt?.redeemedAt)}
          </div>
        </div>
      </div>

      {err ? (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">จำนวนคูปองที่ใช้</div>
          <div className="text-xl font-extrabold">{fmtMoney(couponCount)} ใบ</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">ยอดหักจากคูปองจริง</div>
          <div className="text-xl font-extrabold">
            {fmtMoney(actualCouponUsed)} บาท
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">ยอดบิลรวม</div>
          <div className="text-xl font-extrabold">{fmtMoney(billTotal)} บาท</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">ลูกค้าจ่ายเพิ่ม</div>
          <div
            className={
              payMore > 0
                ? "text-xl font-extrabold text-red-600"
                : "text-xl font-extrabold text-emerald-700"
            }
          >
            {payMore > 0 ? "+" : ""}
            {fmtMoney(payMore)} บาท
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
          <div className="text-sm font-semibold">รายการคูปองที่ใช้</div>
        </div>

        {appliedRows.length ? (
          <div className="max-h-[36dvh] divide-y overflow-y-auto overscroll-contain">
            {appliedRows.map((r) => {
              const appliedAmount = toAmount(r._appliedAmount, 0);
              const faceValue = toAmount(r._faceValue, 180);

              return (
                <div
                  key={r.key}
                  className="flex items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 break-all font-semibold">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        ใบที่ {r._order}
                      </span>

                      <span>Coupon Code : {r.item?.displayCode || "-"}</span>

                      <span
                        className={
                          clean(r.item?.status) === "redeemed"
                            ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-normal text-emerald-700"
                            : "rounded-full bg-blue-100 px-2 py-1 text-xs font-normal text-blue-700"
                        }
                      >
                        {r.item?.status || "-"}
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      {r.item?.holderName || "-"} • {r.item?.courseName || "-"} •{" "}
                      {r.item?.roomName || "-"}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      dayYMD: {r.item?.dayYMD || "-"}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      มูลค่าคูปอง {fmtMoney(faceValue)} บาท
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-xs text-slate-500">ยอดหักจริง</div>
                    <div className="text-lg font-bold">
                      {fmtMoney(appliedAmount)} ฿
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            ยังไม่มีคูปองในบิลนี้
          </div>
        )}
      </div>
    </>
  );
}