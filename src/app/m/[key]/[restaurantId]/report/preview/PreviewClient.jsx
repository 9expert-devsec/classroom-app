"use client";

// C4: Merchant summary image — English only, no prices anywhere
//   1) ดึงทุกแถวของช่วง (all=1)  2) วาดการ์ดสรุปนอกจอ  3) รอรูปโลโก้ + ฟอนต์โหลดครบ
//   4) toPng แบบเดียวกับ ReportDialog เดิม (pixelRatio 2, พื้นขาว, ขนาด scrollWidth/Height)
//   5) แสดงรูป (แตะ = เต็มจอ) + Save image: share sheet ถ้ามือถือรองรับไฟล์ ไม่งั้น <a download>
// ไฟล์ถูกเตรียมไว้ก่อนกด Save — iOS ต้องเรียก navigator.share ในจังหวะที่ผู้ใช้แตะทันที
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toPng } from "html-to-image";
import { ArrowLeft, Download, Home, X } from "lucide-react";

import { slugifyRestaurantName } from "@/lib/reportFilename";
import { ShopLogo } from "../../../ShopPickerClient";
import { ReportTable } from "../ReportClient";
import { rangeKeyOf, fmtRangeDates, fmtAsOf, fmtDayShort, fmtStamp } from "../reportFormat";

const BRAND_LOGO = "/signature_logo_9expert2026_01-ninebule.png";
const CARD_WIDTH = 600;
// เพดานพิกเซลของ canvas (iOS Safari ~16.7M) — การ์ดยาวมากลด pixelRatio ลงแทนที่จะได้รูปเปล่า
const MAX_CANVAS_PIXELS = 16_000_000;
const MAX_CANVAS_SIDE = 16_000;

function waitForImages(root, timeoutMs = 4000) {
  const imgs = Array.from(root.querySelectorAll("img"));
  const each = imgs.map(
    (img) =>
      new Promise((resolve) => {
        if (img.complete && img.naturalWidth) return resolve();
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      }),
  );
  return Promise.race([
    Promise.all(each),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/** Safari / ทุกเบราว์เซอร์บน iOS (WebKit) วาดรูปใน foreignObject ไม่ครบในรอบแรก */
function isWebKitOnly() {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return /AppleWebKit/.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua);
}

function SummaryCard({ cardRef, restaurant, rangeKey, data }) {
  return (
    <div
      ref={cardRef}
      data-testid="summary-card"
      className="bg-white p-8 text-[#0d1b2a]"
      style={{ width: CARD_WIDTH }}
    >
      <div className="flex items-center justify-between gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND_LOGO} alt="9Expert" className="h-9 w-auto" />
        <ShopLogo src={restaurant.logo} alt={restaurant.name} size={56} />
      </div>

      <h1 className="mt-6 text-2xl font-bold">{restaurant.name}</h1>
      <p className="mt-1 text-base font-semibold text-[#2486ff]">
        {data.range.label} · {fmtRangeDates(data.range)}
      </p>
      <p className="mt-1 text-sm text-slate-500">Summary as of {fmtAsOf(data.generatedAt)}</p>

      <div className="mt-6 rounded-2xl bg-[#f8fafd] px-5 py-4 ring-1 ring-black/5">
        <p className="text-sm text-slate-500">Coupons redeemed</p>
        <p className="text-4xl font-bold tabular-nums" data-testid="card-total">
          {data.total}
        </p>
      </div>

      {data.byDay?.length ? (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">By day</p>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {data.byDay.map((d) => (
              <div key={d.dayYMD} className="flex justify-between border-b border-black/5 py-1">
                <span className="text-slate-600">{fmtDayShort(d.dayYMD)}</span>
                <span className="font-semibold tabular-nums">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Redemptions</p>
        {data.rows.length ? (
          <div className="mt-2 rounded-2xl ring-1 ring-black/5">
            <ReportTable rows={data.rows} rangeKey={rangeKey} testId="card-table" />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">No coupons redeemed in this period</p>
        )}
        {data.truncated ? (
          <p className="mt-3 text-sm font-semibold text-[#b8720a]" data-testid="card-truncated">
            List truncated: showing the latest {data.rows.length} of {data.total} redemptions.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function PreviewClient({ merchantKey, restaurant }) {
  const params = useSearchParams();
  const rangeKey = rangeKeyOf(params.get("range"));

  const cardRef = useRef(null);
  const fileRef = useRef(null);
  const [data, setData] = useState(null);
  const [image, setImage] = useState(null); // { url, width, height, filename }
  const [error, setError] = useState("");
  const [full, setFull] = useState(false);
  const [saveNote, setSaveNote] = useState("");

  const reportHref = `/m/${merchantKey}/${restaurant.id}/report?range=${rangeKey}`;

  // 1) ข้อมูลทั้งช่วง
  useEffect(() => {
    const ctrl = new AbortController();
    setData(null);
    setImage(null);
    setError("");
    const q = new URLSearchParams({ restaurantId: restaurant.id, range: rangeKey, all: "1" });
    fetch(`/api/merchant/lunch/report?${q.toString()}`, {
      cache: "no-store",
      headers: { "x-merchant-key": merchantKey },
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (res.status === 429) throw new Error("Too many attempts. Please wait a moment and try again.");
        if (!res.ok) throw new Error("Something went wrong. Please try again.");
        setData(await res.json());
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => ctrl.abort();
  }, [merchantKey, restaurant.id, rangeKey]);

  // 2) การ์ดวาดแล้ว -> รอรูป/ฟอนต์ -> PNG
  useEffect(() => {
    if (!data) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const el = cardRef.current;
        if (!el) throw new Error("card not ready");
        await waitForImages(el);
        await document.fonts?.ready;

        const w = el.scrollWidth;
        const h = el.scrollHeight;
        const pixelRatio = Math.max(
          0.5,
          Math.min(2, Math.sqrt(MAX_CANVAS_PIXELS / (w * h)), MAX_CANVAS_SIDE / h),
        );
        const opts = {
          pixelRatio,
          backgroundColor: "#ffffff",
          width: w,
          height: h,
          style: { transform: "none" },
        };
        if (isWebKitOnly()) await toPng(el, opts); // รอบแรกของ WebKit ทิ้งไป
        const url = await toPng(el, opts);
        if (cancelled) return;

        const filename = `9expert-${slugifyRestaurantName(restaurant.name)}-${rangeKey}-${fmtStamp(data.generatedAt)}.png`;
        const blob = await (await fetch(url)).blob();
        fileRef.current = new File([blob], filename, { type: "image/png" });
        setImage({
          url,
          width: Math.round(w * pixelRatio),
          height: Math.round(h * pixelRatio),
          filename,
        });
      } catch (e) {
        console.error("summary image failed:", e);
        if (!cancelled) setError("Could not create the image. Please try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data, rangeKey, restaurant.name]);

  const download = useCallback(() => {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image.url;
    a.download = image.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [image]);

  async function save() {
    setSaveNote("");
    const file = fileRef.current;
    if (file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${restaurant.name} usage summary` });
      } catch (e) {
        if (e?.name !== "AbortError") {
          download();
          setSaveNote("If the image did not save, press and hold it to save.");
        }
      }
      return;
    }
    download();
  }

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 py-5">
      <div className="flex items-center gap-3">
        <Link
          href={reportHref}
          aria-label="Back to report"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-black/5"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <ShopLogo src={restaurant.logo} alt={restaurant.name} size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-[#0d1b2a]">{restaurant.name}</h1>
          <p className="text-xs text-slate-500">Summary image</p>
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-500" data-testid="preview-asof">
        {data ? `Summary as of ${fmtAsOf(data.generatedAt)}` : " "}
      </p>

      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" data-testid="merchant-error">
          {error}
        </p>
      ) : null}

      <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        {image ? (
          <button type="button" onClick={() => setFull(true)} className="block w-full" aria-label="View full screen">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt="Usage summary"
              data-testid="preview-image"
              data-width={image.width}
              data-height={image.height}
              className="block w-full"
            />
          </button>
        ) : !error ? (
          <p className="px-4 py-16 text-center text-sm text-slate-400">Creating image…</p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={!image}
        data-testid="preview-save"
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2486ff] text-base font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-50"
      >
        <Download className="h-5 w-5" />
        Save image
      </button>
      {saveNote ? <p className="mt-2 text-center text-xs text-slate-500">{saveNote}</p> : null}

      <div className="mt-3 flex gap-3">
        <Link
          href={reportHref}
          className="flex h-12 flex-1 items-center justify-center rounded-xl border border-black/10 bg-white text-base font-medium text-[#0d1b2a]"
        >
          Back
        </Link>
        <Link
          href={`/m/${merchantKey}`}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white text-base font-medium text-[#0d1b2a]"
        >
          <Home className="h-5 w-5 text-slate-500" />
          Home
        </Link>
      </div>

      {/* การ์ดต้นฉบับของรูป — วาดนอกจอ ไม่ให้ผู้ใช้เห็น */}
      {data ? (
        <div aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0">
          <SummaryCard cardRef={cardRef} restaurant={restaurant} rangeKey={rangeKey} data={data} />
        </div>
      ) : null}

      {full && image ? (
        <div
          role="dialog"
          aria-label="Summary image"
          data-testid="preview-full"
          className="fixed inset-0 z-50 overflow-y-auto bg-black/90"
          onClick={() => setFull(false)}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setFull(false)}
            className="fixed right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#0d1b2a]"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt="Usage summary" className="mx-auto block w-full max-w-[720px]" />
        </div>
      ) : null}
    </div>
  );
}
