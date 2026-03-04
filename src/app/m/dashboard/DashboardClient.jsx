"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

export default function DashboardClient() {
  const router = useRouter();

  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const [err, setErr] = useState("");
  const [cText, setCText] = useState("");

  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // 1) load merchant session
  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await fetch("/api/merchant/me");
      if (!r.ok) {
        const next = encodeURIComponent("/m/dashboard");
        router.replace(`/m/login?next=${next}`);
        return;
      }
      const j = await r.json().catch(() => ({}));
      if (!j?.ok) {
        const next = encodeURIComponent("/m/dashboard");
        router.replace(`/m/login?next=${next}`);
        return;
      }
      setMe(j);
      setLoading(false);
    })();
  }, [router]);

  // 2) load recent redeems (optional)
  useEffect(() => {
    if (!me) return;
    let canceled = false;

    (async () => {
      setLoadingItems(true);
      try {
        const r = await fetch("/api/merchant/coupons/recent?limit=10");
        const j = await r.json().catch(() => ({}));
        if (canceled) return;
        if (r.ok && j.ok) setItems(j.items || []);
      } catch {
        // ignore
      } finally {
        if (!canceled) setLoadingItems(false);
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

  function goRedeemFromInput() {
    setErr("");
    const raw = clean(cText);
    if (!raw) {
      setErr("กรุณาวางลิงก์หรือรหัสคูปอง (c) ก่อน");
      return;
    }

    // รองรับ 3 แบบ:
    // 1) /m/redeem?c=...
    // 2) https://.../m/redeem?c=...
    // 3) ใส่ค่า c ตรงๆ
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
    } catch {
      // ignore
    }

    // raw เป็น path?
    if (raw.startsWith("/m/redeem")) {
      try {
        const u = new URL(raw, "http://localhost");
        const c = u.searchParams.get("c");
        if (c) {
          router.push(`/m/redeem?c=${encodeURIComponent(c)}`);
          return;
        }
      } catch {
        // ignore
      }
    }

    // raw เป็น c ตรงๆ
    router.push(`/m/redeem?c=${encodeURIComponent(raw)}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        กำลังโหลด…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* header */}
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {me?.restaurant?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={me.restaurant.logoUrl}
                  alt="logo"
                  className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/10 bg-black/30"
                />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-white/10 ring-1 ring-white/10" />
              )}
              <div>
                <div className="text-xs text-white/60">Merchant</div>
                <div className="text-lg font-semibold">
                  {me?.restaurant?.name || "-"}
                </div>
                <div className="text-xs text-white/50">
                  Logged in as {me?.user?.username || "-"}
                </div>
              </div>
            </div>

            <button
              onClick={doLogout}
              className="rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-sm font-semibold"
            >
              Logout
            </button>
          </div>

          {/* Primary actions */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={goScan}
              className="rounded-2xl bg-emerald-500/90 hover:bg-emerald-500 px-4 py-4 text-lg font-bold"
            >
              📷 สแกน QR
              <div className="mt-1 text-sm font-medium text-emerald-950/90">
                เปิดกล้องเพื่อสแกนคูปองลูกค้า
              </div>
            </button>

            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
              <div className="text-sm font-semibold">วางลิงก์/รหัส (สำรอง)</div>
              <div className="mt-2 flex gap-2">
                <input
                  value={cText}
                  onChange={(e) => setCText(e.target.value)}
                  className="flex-1 rounded-xl bg-black/30 ring-1 ring-white/10 px-3 py-2 outline-none"
                  placeholder="วาง /m/redeem?c=... หรือค่า c"
                />
                <button
                  onClick={goRedeemFromInput}
                  className="rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 font-semibold"
                >
                  ไป
                </button>
              </div>
              {err ? (
                <div className="mt-2 text-sm text-red-300">{err}</div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Recent redeems */}
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">รายการใช้คูปองล่าสุด</div>
              <div className="text-xs text-white/60">แสดงเฉพาะร้านนี้</div>
            </div>
            <button
              onClick={() => router.push("/m/scan")}
              className="rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-sm font-semibold"
            >
              สแกนอีกครั้ง
            </button>
          </div>

          {loadingItems ? (
            <div className="mt-3 text-sm text-white/70">กำลังโหลดรายการ…</div>
          ) : items?.length ? (
            <div className="mt-3 space-y-2">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="rounded-xl bg-black/25 ring-1 ring-white/10 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        Ref. {it.displayCode || "-"}
                      </div>
                      <div className="text-white/70 text-xs mt-1">
                        {it.holderName || "-"} • {it.courseName || "-"}
                      </div>
                      <div className="text-white/60 text-xs mt-1">
                        {fmtDateTimeTH(it.redeemedAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/60">ยอดจริง</div>
                      <div className="font-semibold">
                        {fmtMoney(it.spentAmount)}฿
                      </div>
                      <div className="text-xs text-white/60 mt-1">
                        ส่วนต่าง{" "}
                        <span
                          className={
                            it.diffAmount > 0
                              ? "text-red-300"
                              : "text-emerald-300"
                          }
                        >
                          {it.diffAmount > 0 ? "+" : ""}
                          {fmtMoney(it.diffAmount)}฿
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex justify-end">
                    <button
                      className="rounded-lg bg-white/10 hover:bg-white/15 px-3 py-2 text-xs font-semibold"
                      onClick={() =>
                        router.push(
                          `/m/redeem?c=${encodeURIComponent(it.redeemCipher)}`,
                        )
                      }
                      title="เปิดหน้ารายการนี้อีกครั้ง (จะขึ้นว่าใช้แล้ว)"
                    >
                      ดูรายละเอียด
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-sm text-white/70">
              ยังไม่มีรายการใช้คูปอง
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
