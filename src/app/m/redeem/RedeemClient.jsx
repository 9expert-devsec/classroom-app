// src/app/m/redeem/RedeemClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function pick(sp, key) {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

function fmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

export default function RedeemClient({ searchParams }) {
  const router = useRouter();
  const c = useMemo(() => pick(searchParams, "c"), [searchParams]);

  const [me, setMe] = useState(null);
  const [item, setItem] = useState(null);
  const [spentAmount, setSpentAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const couponPrice = item?.couponPrice ?? 180;
  const spentNum = Number(spentAmount);
  const diffPreview = Number.isFinite(spentNum)
    ? spentNum - Number(couponPrice || 180)
    : null;

  // 1) check merchant session
  useEffect(() => {
    (async () => {
      const r = await fetch("/api/merchant/me");
      if (!r.ok) {
        const next = encodeURIComponent(`/m/redeem?c=${encodeURIComponent(c)}`);
        router.replace(`/m/login?next=${next}`);
        return;
      }
      const j = await r.json();
      if (!j?.ok) {
        const next = encodeURIComponent(`/m/redeem?c=${encodeURIComponent(c)}`);
        router.replace(`/m/login?next=${next}`);
        return;
      }
      setMe(j);
    })();
  }, [c, router]);

  // 2) verify coupon
  useEffect(() => {
    if (!me || !c) return;
    setErr("");
    setItem(null);
    (async () => {
      const r = await fetch("/api/merchant/coupon/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ c }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setErr(j.error || "VERIFY_FAILED");
        return;
      }
      setItem(j.item);
      setSpentAmount(""); // ให้กรอกใหม่ทุกครั้ง
    })();
  }, [me, c]);

  async function onConfirm() {
    setErr("");
    const n = Number(spentAmount);
    if (!Number.isFinite(n) || n < 0) {
      setErr("กรุณากรอกยอดที่ลูกค้าจ่ายจริง (ตัวเลข >= 0)");
      return;
    }

    setBusy(true);
    try {
      const r = await fetch("/api/merchant/coupon/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ c, spentAmount: n }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || "REDEEM_FAILED");

      // แสดงผลลัพธ์ทันที
      setItem((prev) => ({
        ...(prev || {}),
        status: "redeemed",
        spentAmount: j.item?.spentAmount,
        diffAmount: j.item?.diffAmount,
        redeemedAt: j.item?.redeemedAt,
      }));
    } catch (e) {
      setErr(String(e?.message || "REDEEM_FAILED"));
    } finally {
      setBusy(false);
    }
  }

  if (!c) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-4">
        <div>Missing coupon param</div>
        <button
          className="rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-4 py-2 font-semibold"
          onClick={() => router.push("/m/scan")}
        >
          ไปสแกน QR
        </button>
      </div>
    );
  }

  const status = item?.status || "";

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-xl mx-auto">
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-white/60">ร้านค้า</div>
              <div className="text-base font-semibold">
                {me?.restaurant?.name || "-"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-white/60">คูปอง</div>
              <div className="font-semibold">{item?.displayCode || "-"}</div>
            </div>
          </div>

          {err ? <div className="mt-3 text-sm text-red-300">{err}</div> : null}

          {!item ? (
            <div className="mt-4 text-white/70">กำลังโหลดข้อมูลคูปอง…</div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-black/30 ring-1 ring-white/10 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">ผู้ถือคูปอง</span>
                  <span className="font-medium">{item.holderName || "-"}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-white/60">หลักสูตร</span>
                  <span className="font-medium">{item.courseName || "-"}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-white/60">ห้อง</span>
                  <span className="font-medium">{item.roomName || "-"}</span>
                </div>
              </div>

              {status !== "issued" ? (
                <div className="rounded-xl bg-amber-500/10 ring-1 ring-amber-400/30 p-3 text-sm">
                  <div className="font-semibold">คูปองไม่พร้อมใช้งาน</div>
                  <div className="text-white/70 mt-1">
                    สถานะ: <b>{status}</b>
                  </div>
                  {item.redeemedRestaurant ? (
                    <div className="text-white/70 mt-1">
                      ใช้แล้วที่ร้าน: <b>{item.redeemedRestaurant.name}</b>
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="rounded-xl bg-black/30 ring-1 ring-white/10 p-3">
                    <div className="text-sm text-white/60">ยอดคูปอง</div>
                    <div className="text-2xl font-bold">
                      {fmtMoney(couponPrice)} บาท
                    </div>

                    <label className="block mt-3 text-sm text-white/70">
                      ยอดที่ลูกค้าจ่ายจริง (บาท)
                    </label>
                    <input
                      inputMode="numeric"
                      className="mt-1 w-full rounded-xl bg-black/40 ring-1 ring-white/10 px-3 py-2 outline-none text-lg"
                      value={spentAmount}
                      onChange={(e) => setSpentAmount(e.target.value)}
                      placeholder="เช่น 250"
                    />

                    <div className="mt-2 text-sm text-white/70">
                      ส่วนต่าง:{" "}
                      {diffPreview === null ? (
                        "-"
                      ) : diffPreview > 0 ? (
                        <b className="text-red-300">
                          ลูกค้าต้องจ่ายเพิ่ม {fmtMoney(diffPreview)} บาท
                        </b>
                      ) : diffPreview === 0 ? (
                        <b className="text-emerald-300">พอดี 0 บาท</b>
                      ) : (
                        <b className="text-emerald-300">
                          ใช้คูปองครอบ/เกิน {fmtMoney(Math.abs(diffPreview))}{" "}
                          บาท
                        </b>
                      )}
                    </div>

                    <button
                      disabled={busy}
                      onClick={onConfirm}
                      className="mt-4 w-full rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-3 py-2 font-semibold disabled:opacity-60"
                    >
                      {busy ? "กำลังยืนยัน..." : "ยืนยันใช้คูปอง"}
                    </button>

                    <div className="mt-2 text-xs text-white/50">
                      * เมื่อยืนยันแล้ว คูปองจะถูกตัดทันทีและไม่สามารถใช้ซ้ำได้
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
