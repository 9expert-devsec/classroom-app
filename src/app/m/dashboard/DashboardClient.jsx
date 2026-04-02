"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ChevronRight } from "lucide-react";

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

function todayYMD_BKK() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function DashboardClient() {
  const router = useRouter();

  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const [err, setErr] = useState("");
  const [cText, setCText] = useState("");

  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [summary, setSummary] = useState({
    usedCount: 0,
    couponAmount: 0,
    totalAmount: 0,
  });
  const [loadingSummary, setLoadingSummary] = useState(false);

  // 1) load merchant session
  useEffect(() => {
    let canceled = false;

    (async () => {
      setLoading(true);
      const r = await fetch("/api/merchant/me", { cache: "no-store" });
      if (!r.ok) {
        const next = encodeURIComponent("/m/dashboard");
        router.replace(`/m/login?next=${next}`);
        return;
      }
      const j = await r.json().catch(() => ({}));
      if (canceled) return;

      if (!j?.ok) {
        const next = encodeURIComponent("/m/dashboard");
        router.replace(`/m/login?next=${next}`);
        return;
      }

      setMe(j);
      setLoading(false);
    })();

    return () => {
      canceled = true;
    };
  }, [router]);

  // 2) load today summary + today's recent bills
  useEffect(() => {
    if (!me) return;
    let canceled = false;

    (async () => {
      const today = todayYMD_BKK();

      setLoadingItems(true);
      setLoadingSummary(true);

      try {
        const [recentRes, summaryRes] = await Promise.all([
          fetch("/api/merchant/coupons/recent?limit=10&today=1", {
            cache: "no-store",
          }),
          fetch(`/api/merchant/history?start=${today}&end=${today}`, {
            cache: "no-store",
          }),
        ]);

        const recentJson = await recentRes.json().catch(() => ({}));
        const summaryJson = await summaryRes.json().catch(() => ({}));

        if (canceled) return;

        if (recentRes.ok && recentJson?.ok) {
          setItems(Array.isArray(recentJson.items) ? recentJson.items : []);
        } else {
          setItems([]);
        }

        if (summaryRes.ok && summaryJson?.ok) {
          setSummary({
            usedCount: summaryJson?.summary?.usedCount || 0,
            couponAmount: summaryJson?.summary?.couponAmount || 0,
            totalAmount: summaryJson?.summary?.totalAmount || 0,
          });
        } else {
          setSummary({
            usedCount: 0,
            couponAmount: 0,
            totalAmount: 0,
          });
        }
      } catch {
        if (canceled) return;

        setItems([]);
        setSummary({
          usedCount: 0,
          couponAmount: 0,
          totalAmount: 0,
        });
      } finally {
        if (!canceled) {
          setLoadingItems(false);
          setLoadingSummary(false);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [me]);

  async function doLogout() {
    await fetch("/api/merchant/auth/logout", { method: "POST" }).catch(
      () => {},
    );
    router.replace("/m/login");
  }

  function goScan() {
    router.push("/m/scan");
  }

  async function goRedeemFromInput() {
    setErr("");
    const raw = clean(cText);
    if (!raw) {
      setErr("กรุณาวาง Ref (เช่น 9XP4364) หรือวางลิงก์ก่อน");
      return;
    }

    try {
      if (raw.startsWith("http://") || raw.startsWith("https://")) {
        const u = new URL(raw);
        if (u.pathname.startsWith("/m/redeem")) {
          const c = u.searchParams.get("c");
          if (c) {
            router.push(`/m/redeem?c=${encodeURIComponent(c)}`);
            return;
          }
        }
      }
    } catch {}

    if (raw.startsWith("/m/redeem")) {
      try {
        const u = new URL(raw, "http://localhost");
        const c = u.searchParams.get("c");
        if (c) {
          router.push(`/m/redeem?c=${encodeURIComponent(c)}`);
          return;
        }
      } catch {}
    }

    try {
      const r = await fetch("/api/merchant/coupons/by-ref", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ref: raw }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "REF_LOOKUP_FAILED");

      const c = j.item?.redeemCipher;
      if (!c) throw new Error("NO_REDEEM_CIPHER");
      router.push(`/m/redeem?c=${encodeURIComponent(c)}`);
    } catch (e) {
      setErr(
        String(e?.message || "REF_LOOKUP_FAILED") === "NOT_FOUND"
          ? "ไม่พบ Ref นี้ในระบบ"
          : "ค้นหา Ref ไม่สำเร็จ",
      );
    }
  }

  const groupedItems = useMemo(() => {
    const map = new Map();

    for (const it of items || []) {
      const billCode = clean(it?.billCode);

      if (billCode) {
        if (!map.has(billCode)) {
          map.set(billCode, {
            ...it,
            _groupKey: billCode,
          });
        }
        continue;
      }

      const fallbackKey = `coupon:${clean(it?.id) || clean(it?.displayCode) || Math.random().toString(36).slice(2)}`;
      if (!map.has(fallbackKey)) {
        map.set(fallbackKey, {
          ...it,
          _groupKey: fallbackKey,
        });
      }
    }

    return Array.from(map.values());
  }, [items]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FC] text-slate-900 flex items-center justify-center">
        กำลังโหลด…
      </div>
    );
  }

  const restaurantName = me?.restaurant?.name || "-";
  const username = me?.user?.username || "-";
  const logoUrl = me?.restaurant?.logoUrl || "";

  return (
    <div className="min-h-[100dvh] bg-[#F6F8FC] text-slate-900">
      <div className="h-24 shrink-0 bg-gradient-to-r from-[#2B6CFF] via-[#66CCFF] to-[#F6B73C]" />

      <div className="-mt-14 flex min-h-[calc(100dvh-6rem)] flex-col px-4 pb-10">
        <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col gap-4">
          <div className="shrink-0 rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt="logo"
                      className="h-12 w-12 rounded-2xl object-cover border border-slate-200 bg-white"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-2xl bg-slate-100 border border-slate-200" />
                  )}

                  <div>
                    <div className="text-xs text-slate-500">Merchant</div>
                    <div className="text-lg font-bold">{restaurantName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Logged in as{" "}
                      <span className="font-semibold">{username}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={doLogout}
                  className="rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-sm font-semibold"
                >
                  Logout
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={goScan}
                  className="
                    group relative overflow-hidden
                    rounded-3xl bg-emerald-500 text-white
                    px-5 py-5
                    shadow-sm
                    transition
                    hover:bg-emerald-600 hover:shadow-md
                    active:scale-[0.99]
                    focus:outline-none focus:ring-2 focus:ring-emerald-300/70
                  "
                >
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
                    <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-black/10 blur-2xl" />
                  </div>

                  <div className="relative flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                      <Camera className="h-6 w-6" />
                    </div>

                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-extrabold tracking-tight">
                          สแกน QR
                        </span>
                        <ChevronRight className="h-5 w-5 translate-x-0 opacity-80 transition group-hover:translate-x-1" />
                      </div>
                      <div className="mt-1 text-sm font-semibold text-emerald-50/90">
                        เปิดกล้องเพื่อสแกนคูปองลูกค้า
                      </div>
                    </div>
                  </div>
                </button>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold">
                    วางลิงก์/รหัส (สำรอง)
                  </div>
                  <div className="mt-2 flex w-full gap-2">
                    <input
                      value={cText}
                      onChange={(e) => setCText(e.target.value)}
                      className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[#66CCFF]/60 focus:border-[#66CCFF]"
                      placeholder="วาง Ref เช่น 9XPXXXX"
                    />
                    <button
                      onClick={goRedeemFromInput}
                      className="shrink-0 rounded-2xl bg-[#2B6CFF] hover:bg-[#255DE0] text-white px-4 py-2 font-semibold"
                    >
                      ไป
                    </button>
                  </div>

                  {err ? (
                    <div className="mt-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {err}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-slate-500">
                      รองรับ: วางลิงก์เต็ม / วาง path / วางค่า c ตรงๆ
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col p-4 gap-2 rounded-3xl bg-white border border-slate-200 shadow-sm text-sm">
            <div className="flex justify-between items-baseline">
              <div className="text-base font-bold">สรุปยอดการใช้งานวันนี้</div>
              <button
                type="button"
                onClick={() => router.push("/m/history")}
                className="text-sm font-medium text-slate-500 hover:text-slate-900"
              >
                ประวัติ
              </button>
            </div>

            {loadingSummary ? (
              <div className="mt-2 grid grid-cols-3 divide-x divide-slate-200">
                <div className="px-2 text-center">
                  <div className="h-4 w-24 mx-auto rounded bg-slate-100 animate-pulse" />
                  <div className="mt-2 h-7 w-16 mx-auto rounded bg-slate-100 animate-pulse" />
                </div>
                <div className="px-2 text-center">
                  <div className="h-4 w-24 mx-auto rounded bg-slate-100 animate-pulse" />
                  <div className="mt-2 h-7 w-20 mx-auto rounded bg-slate-100 animate-pulse" />
                </div>
                <div className="px-2 text-center">
                  <div className="h-4 w-20 mx-auto rounded bg-slate-100 animate-pulse" />
                  <div className="mt-2 h-7 w-20 mx-auto rounded bg-slate-100 animate-pulse" />
                </div>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-3 divide-x divide-slate-200">
                <div className="px-2 text-center">
                  <div className="text-sm text-slate-500">จำนวนคูปองที่ใช้</div>
                  <div className="mt-2 text-xl font-bold text-slate-900">
                    {fmtMoney(summary.usedCount)}
                  </div>
                  <div className="text-sm text-slate-400">คูปอง</div>
                </div>
                <div className="px-2 text-center">
                  <div className="text-sm text-slate-500">ยอดเงินจากคูปอง</div>
                  <div className="mt-2 text-xl font-bold text-slate-900">
                    {fmtMoney(summary.couponAmount)}
                  </div>
                  <div className="text-sm text-slate-400">บาท</div>
                </div>
                <div className="px-2 text-center">
                  <div className="text-sm text-slate-500">ยอดรวม</div>
                  <div className="mt-2 text-xl font-bold text-slate-900">
                    {fmtMoney(summary.totalAmount)}
                  </div>
                  <div className="text-sm text-slate-400">บาท</div>
                </div>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex h-full min-h-0 flex-col p-5">
              <div className="shrink-0 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">รายการใช้คูปองวันนี้</div>
                </div>
              </div>

              {loadingItems ? (
                <div className="mt-4 space-y-2">
                  <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
                  <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
                  <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
                </div>
              ) : groupedItems?.length ? (
                <div className="mt-4 space-y-2 overflow-y-auto">
                  {groupedItems.map((it) => {
                    const billCode = clean(it.billCode);
                    const billTotal = Number(it.billTotal);
                    const billPayMore = Number(it.billPayMore);
                    const billCouponCount = Number(it.billCouponCount);

                    const showTotal =
                      Number.isFinite(billTotal) && billTotal > 0
                        ? billTotal
                        : Number(it.spentAmount) || 0;

                    const showDiff =
                      Number.isFinite(billPayMore) && billCode
                        ? billPayMore
                        : Number(it.diffAmount) || 0;

                    return (
                      <div
                        key={it._groupKey || it.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-bold break-all">
                              {billCode || it.displayCode || "-"}
                            </div>

                            {billCode ? (
                              <div className="text-slate-600 text-xs mt-1">
                                {billCouponCount > 0
                                  ? `${billCouponCount} คูปอง`
                                  : "รายการแบบ bill"}
                              </div>
                            ) : (
                              <div className="text-slate-600 text-xs mt-1 truncate">
                                {it.holderName || "-"} • {it.courseName || "-"}
                              </div>
                            )}

                            <div className="text-slate-500 text-xs mt-1">
                              {fmtDateTimeTH(it.redeemedAt)}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-xs text-slate-500">
                              ยอดจริง
                            </div>
                            <div className="font-bold">
                              {fmtMoney(showTotal)}฿
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              ส่วนต่าง{" "}
                              <span
                                className={
                                  showDiff > 0
                                    ? "text-red-600 font-semibold"
                                    : "text-emerald-700 font-semibold"
                                }
                              >
                                {showDiff > 0 ? "+" : ""}
                                {fmtMoney(showDiff)}฿
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex justify-end">
                          <button
                            className="rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2 text-xs font-semibold"
                            onClick={() => {
                              if (billCode) {
                                router.push(
                                  `/m/redeem?bill=${encodeURIComponent(billCode)}`,
                                );
                                return;
                              }

                              router.push(
                                `/m/redeem?c=${encodeURIComponent(it.redeemCipher)}`,
                              );
                            }}
                            title="เปิดหน้ารายการนี้อีกครั้ง"
                          >
                            ดูรายละเอียด
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  ยังไม่มีรายการใช้คูปองวันนี้
                </div>
              )}
            </div>
          </div>

          <div className="text-center text-xs text-slate-500">
            © 9Expert Training
          </div>
        </div>
      </div>
    </div>
  );
}
