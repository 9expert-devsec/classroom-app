"use client";

// C4: Merchant usage summary — English only, mobile-first, no prices anywhere
// range / page อยู่ใน URL (?range=week&page=2) เป็นแหล่งความจริงเดียว ไม่ copy ลง state
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, ImageDown } from "lucide-react";

import { ShopLogo } from "../../ShopPickerClient";
import { RANGES, rangeKeyOf, fmtRowTime, fmtRangeDates } from "./reportFormat";

/** compact = จอมือถือ (ตัวเล็ก ช่องแคบ ให้ 5 คอลัมน์พอดี 390px), ไม่ compact = การ์ดในรูปสรุป */
export function ReportTable({ rows, rangeKey, testId, compact = false }) {
  const cell = compact ? "px-2 py-2" : "px-3 py-2";
  return (
    <table className={compact ? "w-full text-left text-xs" : "w-full text-left text-sm"} data-testid={testId}>
      <thead className="text-xs uppercase text-slate-400">
        <tr>
          <th className={`${cell} font-medium`}>{rangeKey === "today" ? "Time" : "Date / Time"}</th>
          <th className={`${cell} font-medium`}>Nickname</th>
          <th className={`${cell} font-medium`}>Name</th>
          <th className={`${cell} font-medium`}>Room</th>
          <th className={`${cell} font-medium`}>Code</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-black/5">
        {rows.map((r, i) => (
          <tr key={`${r.code}-${r.redeemedAt}-${i}`}>
            <td className={`whitespace-nowrap ${cell} tabular-nums`}>
              {fmtRowTime(r.redeemedAt, rangeKey)}
            </td>
            <td className={cell}>{r.nickname || "-"}</td>
            <td className={cell}>{r.name || "-"}</td>
            <td className={cell}>{r.room || "-"}</td>
            <td className={`whitespace-nowrap ${cell} font-mono`}>{r.code}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ReportClient({ merchantKey, restaurant }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const rangeKey = rangeKeyOf(params.get("range"));
  const page = Math.max(1, Math.floor(Number(params.get("page")) || 1));

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const go = useCallback(
    (nextRange, nextPage) => {
      const q = new URLSearchParams({ range: nextRange });
      if (nextPage > 1) q.set("page", String(nextPage));
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [router, pathname],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    const q = new URLSearchParams({ restaurantId: restaurant.id, range: rangeKey, page: String(page) });
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
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [merchantKey, restaurant.id, rangeKey, page]);

  const shown = data && !error ? data : null;
  const shopHref = `/m/${merchantKey}/${restaurant.id}`;

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 py-5">
      <div className="flex items-center gap-3">
        <Link
          href={shopHref}
          aria-label="Back to shop"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-black/5"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <ShopLogo src={restaurant.logo} alt={restaurant.name} size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-[#0d1b2a]">{restaurant.name}</h1>
          <p className="text-xs text-slate-500">Usage summary</p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Period"
        className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-black/5 p-1"
        data-testid="report-range"
      >
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            role="tab"
            aria-selected={rangeKey === r.key}
            onClick={() => rangeKey !== r.key && go(r.key, 1)}
            className={[
              "h-10 rounded-lg text-sm font-semibold transition",
              rangeKey === r.key ? "bg-white text-[#0d1b2a] shadow-sm" : "text-slate-500",
            ].join(" ")}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" data-testid="merchant-error">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">{shown ? fmtRangeDates(shown.range) : " "}</p>
          <p className="text-sm text-slate-500">
            Coupons redeemed:{" "}
            <span className="text-2xl font-bold tabular-nums text-[#0d1b2a]" data-testid="report-total">
              {shown ? shown.total : "–"}
            </span>
          </p>
        </div>
        {loading ? <span className="text-xs text-slate-400">Loading…</span> : null}
      </div>

      <div
        className={[
          "mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition-opacity",
          loading ? "opacity-60" : "",
        ].join(" ")}
      >
        {shown && shown.total > 0 ? (
          <ReportTable rows={shown.rows} rangeKey={rangeKey} testId="report-table" compact />
        ) : (
          <p className="px-4 py-8 text-center text-sm text-slate-400" data-testid="report-empty">
            {shown ? "No coupons redeemed in this period" : " "}
          </p>
        )}
      </div>

      {shown && shown.pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-between gap-3" data-testid="report-pager">
          <button
            type="button"
            onClick={() => go(rangeKey, shown.page - 1)}
            disabled={loading || shown.page <= 1}
            className="flex h-10 items-center gap-1 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-[#0d1b2a] disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>
          <span className="text-sm tabular-nums text-slate-500">
            Page {shown.page} of {shown.pageCount}
          </span>
          <button
            type="button"
            onClick={() => go(rangeKey, shown.page + 1)}
            disabled={loading || shown.page >= shown.pageCount}
            className="flex h-10 items-center gap-1 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-[#0d1b2a] disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <Link
        href={`${shopHref}/report/preview?range=${rangeKey}`}
        data-testid="report-export"
        className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2486ff] text-base font-semibold text-white shadow-sm active:scale-[0.99]"
      >
        <ImageDown className="h-5 w-5" />
        Export summary
      </Link>
    </div>
  );
}
