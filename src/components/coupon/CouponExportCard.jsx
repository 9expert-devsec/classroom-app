"use client";

import { forwardRef } from "react";
import QRCode from "react-qr-code";
import localFont from "next/font/local";

const lineSeedSansTH = localFont({
  src: [
    {
      path: "../../../public/fonts/GoogleSans-Regular.ttf",
      weight: "400",
    },
    {
      path: "../../../public/fonts/GoogleSans-Bold.ttf",
      weight: "700",
    },
  ],
  display: "swap",
});

function fmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function fmtDateTH(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function fmtTimeTH(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

const CouponExportCard = forwardRef(function CouponExportCard(
  { coupon, issuedAt, expireAt, couponDayYMD, qrValue, terms = [], note = "" },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`w-[1080px] bg-[#F6F8FC] p-10 text-slate-900 ${lineSeedSansTH.className}`}
    >
      <div className="rounded-[40px]">
        {/* <div className="absolute -left-[18px] top-[300px] z-20 h-[36px] w-[36px] rounded-full bg-[#F6F8FC]" />
        <div className="absolute -right-[18px] top-[300px] z-20 h-[36px] w-[36px] rounded-full bg-[#F6F8FC]" /> */}

        <div className="overflow-hidden rounded-[40px] border border-slate-200 bg-white">
          <div className="bg-gradient-to-r from-[#2486ff] to-[#48b0ff] px-10 py-10 text-center">
            <img
              src="/logo-9experttraining-white-color-2.png"
              alt="9Expert Training"
              className="mx-auto h-20 w-auto"
            />

            <div className="mt-4 text-5xl font-bold text-white">
              Cash Coupon
            </div>

            <div className="mt-2 text-6xl font-bold tracking-tight text-white">
              {fmtMoney(coupon?.couponPrice || 180)} THB
            </div>
          </div>

          <div className="relative shrink-0">
            <div className="relative px-6">
              <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 border-t-4 border-dashed border-[#f5f7fa]" />
            </div>
          </div>

          <div className="px-10 py-8">
            <div className="text-center text-xl font-bold">
              ให้ร้านค้าสแกน QR ด้านล่างเพื่อใช้คูปอง
            </div>

            <div className="mt-6 flex justify-center">
              <div className="rounded-3xl bg-white border-4 border-[#48B0FF] p-6">
                {qrValue ? (
                  <QRCode
                    value={qrValue}
                    size={320}
                    style={{ width: 320, height: 320 }}
                  />
                ) : (
                  <div className="grid h-[320px] w-[320px] place-items-center text-xl text-slate-500">
                    QR ไม่พร้อมใช้งาน
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 text-center text-3xl text-slate-600">
              Ref.{" "}
              <span className="font-extrabold text-slate-900">
                {coupon?.displayCode || "-"}
              </span>
            </div>

            <div className="mt-8 rounded-[28px] border border-slate-200 bg-slate-50 p-6 text-left text-2xl">
              <div className="flex justify-between gap-6">
                <span className="text-slate-500">เจ้าของคูปอง</span>
                <span className="font-medium text-right">
                  {coupon?.holderName || "-"}
                </span>
              </div>

              <div className="mt-3 flex justify-between gap-6">
                <span className="text-slate-500">หลักสูตร</span>
                <span className="font-medium text-right">
                  {coupon?.courseName || "-"}
                </span>
              </div>

              <div className="mt-3 flex justify-between gap-6">
                <span className="text-slate-500">ห้องอบรม</span>
                <span className="font-medium text-right">
                  {coupon?.roomName || "-"}
                </span>
              </div>

              <div className="mt-3 flex justify-between gap-6">
                <span className="text-slate-500">วันที่ออกคูปอง</span>
                <span className="font-medium text-right">
                  {fmtDateTH(issuedAt)} เวลา{" "}
                  {issuedAt ? `${fmtTimeTH(issuedAt)} น.` : "-"}
                </span>
              </div>

              <div className="mt-3 flex justify-between gap-6 font-bold">
                <span className="text-slate-500">ใช้ได้ถึง</span>
                <span className="text-right">
                  {expireAt
                    ? `${fmtDateTH(expireAt)} เวลา ${fmtTimeTH(expireAt)} น.`
                    : couponDayYMD
                      ? `${fmtDateTH(`${couponDayYMD}T15:00:00+07:00`)} เวลา 15:00 น.`
                      : "15:00 น. ของวันคูปอง"}
                </span>
              </div>
            </div>

            <div className="mt-10 rounded-[28px] border border-slate-200 bg-white p-8">
              <div className="text-3xl font-bold text-slate-800">
                เงื่อนไขการใช้คูปองร้านอาหาร
              </div>

              <ol className="mt-6 space-y-4 text-2xl leading-10 text-slate-700">
                {terms.map((item, idx) => (
                  <li key={idx}>
                    <div className="flex gap-3">
                      <span className="font-semibold text-slate-900">
                        {idx + 1}.
                      </span>
                      <span>{item.title}</span>
                    </div>

                    {Array.isArray(item.subs) && item.subs.length ? (
                      <ul className="mt-2 ml-10 list-disc space-y-1 text-slate-600">
                        {item.subs.map((sub, subIdx) => (
                          <li key={subIdx}>{sub}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ol>

              {note ? (
                <div className="mt-8 border-t pt-5 text-2xl font-medium leading-9 text-red-500">
                  {note}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default CouponExportCard;
