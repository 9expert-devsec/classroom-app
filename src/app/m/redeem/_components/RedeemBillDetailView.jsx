"use client";

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

export default function RedeemBillDetailView({
  restaurantName,
  billCode,
  billMeta,
  rows,
  receipt,
  err,
  onBackDashboard,
}) {
  return (
    <>
      {/* <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        โหมดดูรายละเอียดบิลที่ใช้แล้ว
      </div> */}

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
              {billMeta.courseName} • {billMeta.roomName} • {billMeta.dayYMD}
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4 mt-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">จำนวนคูปองที่ใช้</div>
          <div className="text-xl font-extrabold">
            {fmtMoney(receipt?.couponCount)} ใบ
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">ยอดคูปองรวม</div>
          <div className="text-xl font-extrabold">
            {fmtMoney(receipt?.couponTotal)} บาท
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">ยอดบิลรวม</div>
          <div className="text-xl font-extrabold">
            {fmtMoney(receipt?.billTotal)} บาท
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">ลูกค้าจ่ายเพิ่ม</div>
          <div
            className={
              Number(receipt?.payMore) > 0
                ? "text-xl font-extrabold text-red-600"
                : "text-xl font-extrabold text-emerald-700"
            }
          >
            {Number(receipt?.payMore) > 0 ? "+" : ""}
            {fmtMoney(receipt?.payMore)} บาท
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
          <div className="text-sm font-semibold">
            {/* คูปองในบิลนี้ ({rows.length}) */}
            รายการคูปองที่ใช้
          </div>
        </div>

        {rows.length ? (
          <div className="max-h-[36dvh] divide-y overflow-y-auto overscroll-contain">
            {rows.map((r) => (
              <div
                key={r.key}
                className="flex items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="break-all font-semibold flex flex-row gap-3 items-center">
                    Coupon Code : {r.item?.displayCode || "-"}{" "} 
                    {/* <span className="ml-2 text-xs text-slate-500">
                      ({r.item?.couponPrice ?? 180}฿)
                    </span> */}
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
                </div>

                <div className="shrink-0">
                  <span className="ml-2 text-lg font-bold">
                    {r.item?.couponPrice ?? 180} ฿
                  </span>
                  {/* <span
                    className={
                      clean(r.item?.status) === "redeemed"
                        ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700"
                        : "rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700"
                    }
                  >
                    {r.item?.status || "-"}
                  </span> */}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            ยังไม่มีคูปองในบิลนี้
          </div>
        )}
      </div>

      {/* <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">ยอดคูปองรวม</div>
            <div className="text-xl font-extrabold">
              {fmtMoney(receipt?.couponTotal)} บาท
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">ยอดบิลรวม</div>
            <div className="text-xl font-extrabold">
              {fmtMoney(receipt?.billTotal)} บาท
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">ลูกค้าจ่ายเพิ่ม</div>
            <div
              className={
                Number(receipt?.payMore) > 0
                  ? "text-xl font-extrabold text-red-600"
                  : "text-xl font-extrabold text-emerald-700"
              }
            >
              {Number(receipt?.payMore) > 0 ? "+" : ""}
              {fmtMoney(receipt?.payMore)} บาท
            </div>
          </div>
        </div>

        {receipt ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <div className="font-bold text-emerald-800">
              🧾 รายละเอียดบิลที่ใช้แล้ว
            </div>

            <div className="mt-2 text-slate-700">
              Bill: <b>{receipt.billCode}</b>
            </div>

            <div className="text-slate-700">
              จำนวนคูปองที่ใช้ {receipt.couponCount} ใบ • คูปองรวม{" "}
              <b>{fmtMoney(receipt.couponTotal)}</b> • ยอดบิล{" "}
              <b>{fmtMoney(receipt.billTotal)}</b>
            </div>

            <div className="text-slate-700">
              ลูกค้าจ่ายเพิ่ม:{" "}
              <b
                className={
                  receipt.payMore > 0 ? "text-red-700" : "text-emerald-700"
                }
              >
                {receipt.payMore > 0 ? "+" : ""}
                {fmtMoney(receipt.payMore)}
              </b>
            </div>

            <div className="mt-1 text-xs text-slate-500">
              เวลา: {fmtDateTimeTH(receipt.redeemedAt)}
            </div>

            <div className="mt-3">
              <button
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 font-semibold hover:bg-slate-50"
                onClick={onBackDashboard}
              >
                กลับ Dashboard
              </button>
            </div>
          </div>
        ) : null}
      </div> */}
    </>
  );
}
