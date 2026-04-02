"use client";

import PasteOrRefBox from "./PasteOrRefBox";

function clean(x) {
  return String(x ?? "").trim();
}

function fmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

export default function RedeemActiveView({
  restaurantName,
  billCode,
  billMeta,
  rows,
  err,
  done,
  adding,
  billTotalText,
  setBillTotalText,
  payMore,
  couponTotal,
  onOpenScan,
  onRemoveRow,
  onConfirmBill,
  onBackDashboard,
  onAddText,
  receipt,
  onResetBill,
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-500">ร้านค้า</div>
          <div className="text-lg font-bold">{restaurantName}</div>
          <div className="mt-0.5 break-all text-xs text-slate-500">
            Bill: <span className="font-semibold text-slate-700">{billCode}</span>
          </div>

          {billMeta ? (
            <div className="mt-1 text-xs text-slate-500">
              {billMeta.courseName} • {billMeta.roomName} • {billMeta.dayYMD}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            onClick={onBackDashboard}
          >
            Dashboard
          </button>

          <button
            className="rounded-2xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
            onClick={onOpenScan}
            disabled={done}
          >
            สแกนเพิ่ม
          </button>
        </div>
      </div>

      {err ? (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <button
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left hover:bg-slate-100 disabled:opacity-60"
          onClick={onOpenScan}
          disabled={done}
        >
          <div className="text-sm font-bold">📷 สแกน QR เพื่อเพิ่มคูปอง</div>
          <div className="mt-1 text-xs text-slate-500">
            แนะนำให้ใช้สแกนเป็นหลัก (แม่นสุด)
          </div>
        </button>

        <PasteOrRefBox
          disabled={done || adding}
          onAdd={(text) => onAddText?.(text)}
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
          <div className="text-sm font-semibold">คูปองในบิลนี้ ({rows.length})</div>
          {!rows.length ? (
            <div className="text-xs text-slate-500">เพิ่มคูปองก่อน</div>
          ) : null}
        </div>

        {rows.length ? (
          <div className="max-h-[36dvh] divide-y overflow-y-auto overscroll-contain">
            {rows.map((r) => (
              <div
                key={r.key}
                className="flex items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="break-all font-semibold">
                    Ref. {r.item?.displayCode || "-"}{" "}
                    <span className="ml-2 text-xs text-slate-500">
                      ({r.item?.couponPrice ?? 180}฿)
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

                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={
                      clean(r.item?.status) === "redeemed"
                        ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700"
                        : "rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700"
                    }
                  >
                    {r.item?.status || "-"}
                  </span>

                  {!done ? (
                    <button
                      className="rounded-xl border border-slate-200 px-2 py-1 text-xs font-semibold hover:bg-slate-50"
                      onClick={() => onRemoveRow?.(r.key)}
                    >
                      เอาออก
                    </button>
                  ) : null}
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

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">ยอดคูปองรวม</div>
            <div className="text-xl font-extrabold">{fmtMoney(couponTotal)} บาท</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 md:col-span-2">
            <div className="text-xs text-slate-500">ยอดบิลรวม (บาท)</div>
            <input
              inputMode="numeric"
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg outline-none focus:border-[#66CCFF] focus:ring-2 focus:ring-[#66CCFF]/60"
              value={billTotalText}
              onChange={(e) => setBillTotalText?.(e.target.value)}
              placeholder="เช่น 540 (รวมทั้งบิล)"
              disabled={done}
            />

            <div className="mt-2 text-sm text-slate-600">
              ลูกค้าจ่ายเพิ่ม:{" "}
              {payMore === null ? (
                "-"
              ) : payMore > 0 ? (
                <b className="text-red-600">+{fmtMoney(payMore)} บาท</b>
              ) : (
                <b className="text-emerald-700">0 บาท</b>
              )}
            </div>
          </div>
        </div>

        <button
          disabled={adding || done}
          onClick={onConfirmBill}
          className="mt-4 w-full rounded-2xl bg-[#2B6CFF] px-4 py-3 font-semibold text-white hover:bg-[#255DE0] disabled:opacity-60"
        >
          {adding ? "กำลังยืนยัน..." : done ? "ยืนยันแล้ว" : "ยืนยันใช้คูปอง (ตัดทั้งบิล)"}
        </button>

        <div className="mt-2 text-xs text-slate-500">
          * ระบบจะตัดคูปองทุกใบในบิลนี้พร้อมกัน และคำนวณ “จ่ายเพิ่ม” จาก
          (ยอดบิลรวม - ยอดคูปองรวม)
        </div>

        {done && receipt ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <div className="font-bold text-emerald-800">✅ ตัดคูปองสำเร็จ</div>

            <div className="mt-2 text-slate-700">
              Bill: <b>{receipt.billCode}</b>
            </div>

            <div className="text-slate-700">
              คูปอง {receipt.couponCount} ใบ • คูปองรวม{" "}
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
              เวลา: {receipt.redeemedAt || "-"}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 font-semibold hover:bg-slate-50"
                onClick={onBackDashboard}
              >
                กลับ Dashboard
              </button>

              <button
                className="flex-1 rounded-2xl bg-emerald-500 px-3 py-2 font-semibold text-white hover:bg-emerald-600"
                onClick={onResetBill}
              >
                เริ่มบิลใหม่
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}