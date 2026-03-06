// src/app/m/redeem/RedeemClient.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function pick(sp, key) {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

function clean(x) {
  return String(x ?? "").trim();
}

function cleanRef(x) {
  return clean(x).toUpperCase().replace(/\s+/g, "");
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

function payMoreOf(billTotal, couponTotal) {
  const b = Number(billTotal);
  const c = Number(couponTotal);
  if (!Number.isFinite(b) || !Number.isFinite(c)) return 0;
  return Math.max(0, b - c);
}

function looksLikeCipher(s) {
  return /^[A-Za-z0-9_-]{12,}$/.test(clean(s));
}

function extractRefFromText(s) {
  const t = cleanRef(s);
  const m = t.match(/(9XP[A-Z0-9]{3,})/);
  return m ? m[1] : "";
}

function extractCouponIdFromPathname(pathname) {
  const m = String(pathname || "").match(/^\/coupon\/([^\/?#]+)/);
  return m ? m[1] : "";
}

function couponCodeOf(it) {
  return clean(it?.displayCode).toUpperCase();
}

function friendlyErr(msg) {
  const s = clean(msg);

  if (!s) return "เกิดข้อผิดพลาดบางอย่าง";
  if (s === "VERIFY_FAILED") return "ตรวจสอบคูปองไม่สำเร็จ";
  if (s === "REDEEM_BILL_FAILED") return "ยืนยันใช้คูปองไม่สำเร็จ";
  if (s === "COUPON_DIFF_DAY") return "คูปองนี้อยู่คนละวันกับคูปองใบแรกในบิล";
  if (s === "COUPON_DIFF_COURSE")
    return "คูปองนี้อยู่คนละคอร์สกับคูปองใบแรกในบิล";
  if (s === "COUPON_DIFF_ROOM") return "คูปองนี้อยู่คนละห้องกับคูปองใบแรกในบิล";
  if (s === "MISSING_DISPLAY_CODE") return "ไม่พบรหัสคูปอง";
  if (s.startsWith("COUPON_NOT_ISSUED:")) {
    const tail = s.replace("COUPON_NOT_ISSUED:", "").trim();
    return tail
      ? `คูปองนี้ไม่อยู่ในสถานะ issued (${tail})`
      : "คูปองนี้ไม่อยู่ในสถานะ issued";
  }
  return s;
}

export default function RedeemClient({ searchParams }) {
  const router = useRouter();

  const cInit = useMemo(() => pick(searchParams, "c"), [searchParams]);
  const refInit = useMemo(() => pick(searchParams, "ref"), [searchParams]);

  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [err, setErr] = useState("");

  const [billCode, setBillCode] = useState("");
  const [billTotalText, setBillTotalText] = useState("");

  const [rows, setRows] = useState([]); // { key, source:{c/ref}, item }
  const [adding, setAdding] = useState(false);

  const [done, setDone] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const [scanOpen, setScanOpen] = useState(false);
  const [scanErr, setScanErr] = useState("");
  const videoRef = useRef(null);
  const controlsRef = useRef(null);

  // กัน auto-add ซ้ำจาก StrictMode/dev
  const initAddedRef = useRef(new Set());

  // เก็บ rows ล่าสุดไว้เช็คซ้ำแบบ sync
  const rowsRef = useRef([]);

  // กัน request verify/add ตัวเดิมซ้ำระหว่างกำลังรันอยู่
  const inFlightAddRef = useRef(new Set());

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const BASE = useMemo(() => {
    const b = clean(process.env.NEXT_PUBLIC_BASE_URL);
    if (b) return b.replace(/\/+$/, "");
    if (typeof window !== "undefined") return window.location.origin;
    return "";
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingMe(true);

      const next = encodeURIComponent(
        `/m/redeem${
          cInit
            ? `?c=${encodeURIComponent(cInit)}`
            : refInit
              ? `?ref=${encodeURIComponent(refInit)}`
              : ""
        }`,
      );

      try {
        const r = await fetch("/api/merchant/me", { cache: "no-store" });
        if (!r.ok) {
          router.replace(`/m/login?next=${next}`);
          return;
        }

        const j = await r.json().catch(() => ({}));
        if (!j?.ok) {
          router.replace(`/m/login?next=${next}`);
          return;
        }

        setMe(j);
      } finally {
        setLoadingMe(false);
      }
    })();
  }, [router, cInit, refInit]);

  useEffect(() => {
    if (billCode) return;
    const ymd = todayYMD_BKK().replaceAll("-", "");
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    const ts = Date.now().toString().slice(-6);
    setBillCode(`BILL-${ymd}-${ts}-${rand}`);
  }, [billCode]);

  const billMeta = useMemo(() => {
    const first = rows?.[0]?.item;
    if (!first) return null;
    return {
      dayYMD: clean(first.dayYMD),
      courseName: clean(first.courseName),
      roomName: clean(first.roomName),
    };
  }, [rows]);

  const couponTotal = useMemo(() => {
    return (rows || []).reduce((a, r) => {
      const p = Number(r?.item?.couponPrice ?? 180);
      return a + (Number.isFinite(p) ? p : 180);
    }, 0);
  }, [rows]);

  const billTotalNum = Number(billTotalText);

  const payMore = useMemo(() => {
    if (!Number.isFinite(billTotalNum)) return null;
    return payMoreOf(billTotalNum, couponTotal);
  }, [billTotalNum, couponTotal]);

  async function verifyAndAdd({ c, ref, silentDuplicate = false }) {
    const refNorm = ref ? cleanRef(ref) : "";
    const payload = {};
    if (c) payload.c = c;
    if (refNorm) payload.ref = refNorm;

    const inputKey = c ? `c:${c}` : refNorm ? `r:${refNorm}` : "";
    if (!inputKey) return;

    // กันยิงตัวเดิมซ้ำขณะ request แรกยังไม่จบ
    if (inFlightAddRef.current.has(inputKey)) return;
    inFlightAddRef.current.add(inputKey);

    setAdding(true);
    setErr("");

    try {
      const r = await fetch("/api/merchant/coupons/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || "VERIFY_FAILED");

      const it = j.item;

      if (clean(it.status) !== "issued") {
        const usedAt = it.redeemedAt
          ? ` (${fmtDateTimeTH(it.redeemedAt)})`
          : "";
        throw new Error(
          `COUPON_NOT_ISSUED: ${it.status}${it.merchantName ? ` @${it.merchantName}` : ""}${usedAt}`,
        );
      }

      if (billMeta) {
        if (clean(it.dayYMD) !== billMeta.dayYMD) {
          throw new Error("COUPON_DIFF_DAY");
        }
        if (clean(it.courseName) !== billMeta.courseName) {
          throw new Error("COUPON_DIFF_COURSE");
        }
        if (clean(it.roomName) !== billMeta.roomName) {
          throw new Error("COUPON_DIFF_ROOM");
        }
      }

      const code = couponCodeOf(it);
      if (!code) throw new Error("MISSING_DISPLAY_CODE");

      const exists = rowsRef.current.some(
        (x) => couponCodeOf(x?.item) === code,
      );
      if (exists) {
        if (!silentDuplicate) {
          setErr("คูปองนี้ถูกเพิ่มในบิลแล้ว");
        }
        return;
      }

      const nextRow = {
        key: code,
        source: c ? { c } : { ref: refNorm },
        item: it,
      };

      // อัปเดต ref ก่อน เพื่อกัน call ซ้อนเห็นค่าเก่า
      rowsRef.current = [...rowsRef.current, nextRow];

      setRows((prev) => {
        const alreadyExists = prev.some((x) => couponCodeOf(x?.item) === code);
        if (alreadyExists) return prev;
        return [...prev, nextRow];
      });
    } catch (e) {
      setErr(friendlyErr(String(e?.message || "VERIFY_FAILED")));
    } finally {
      inFlightAddRef.current.delete(inputKey);
      setAdding(false);
    }
  }

  useEffect(() => {
    if (!me) return;
    if (!cInit && !refInit) return;
    if (done) return;

    const initKey = cInit ? `c:${cInit}` : `r:${cleanRef(refInit)}`;
    if (initAddedRef.current.has(initKey)) return;
    initAddedRef.current.add(initKey);

    (async () => {
      await verifyAndAdd(
        cInit
          ? { c: cInit, silentDuplicate: true }
          : { ref: cleanRef(refInit), silentDuplicate: true },
      );
      router.replace("/m/redeem");
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, cInit, refInit, done]);

  function removeRow(k) {
    if (done) return;
    setRows((prev) => {
      const next = prev.filter((x) => x.key !== k);
      rowsRef.current = next;
      return next;
    });
  }

  async function confirmBill() {
    setErr("");

    if (!rows.length) {
      setErr("กรุณาเพิ่มคูปองอย่างน้อย 1 ใบ");
      return;
    }

    const n = Number(billTotalText);
    if (!Number.isFinite(n) || n < 0) {
      setErr("กรุณากรอกยอดบิลรวม (ตัวเลข >= 0)");
      return;
    }

    setAdding(true);

    try {
      const payload = {
        billCode,
        billTotal: n,
        coupons: rows.map((r) =>
          r.source?.c ? { c: r.source.c } : { ref: r.source.ref },
        ),
      };

      const r = await fetch("/api/merchant/bills/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || "REDEEM_BILL_FAILED");

      setDone(true);
      setReceipt(j.bill);

      setRows((prev) => {
        const next = prev.map((x) => ({
          ...x,
          item: {
            ...x.item,
            status: "redeemed",
            redeemedAt: j.bill?.redeemedAt || new Date().toISOString(),
          },
        }));
        rowsRef.current = next;
        return next;
      });
    } catch (e) {
      setErr(friendlyErr(String(e?.message || "REDEEM_BILL_FAILED")));
    } finally {
      setAdding(false);
    }
  }

  async function parseTextAndAdd(text) {
    const t = clean(text);
    if (!t) return;

    try {
      const u = new URL(t, BASE || "http://localhost");

      if (u.pathname.startsWith("/m/redeem")) {
        const c = u.searchParams.get("c");
        const ref = u.searchParams.get("ref");
        if (c) return verifyAndAdd({ c });
        if (ref) return verifyAndAdd({ ref: cleanRef(ref) });
      }

      const couponId = extractCouponIdFromPathname(u.pathname);
      if (couponId) {
        const rr = await fetch(
          `/api/public/coupon/${encodeURIComponent(couponId)}`,
          { cache: "no-store" },
        );
        const jj = await rr.json().catch(() => ({}));
        const redeemCipher = jj?.item?.redeemCipher || "";
        if (rr.ok && jj.ok && redeemCipher) {
          return verifyAndAdd({ c: redeemCipher });
        }
      }
    } catch {
      // ignore
    }

    const ref = extractRefFromText(t);
    if (ref) return verifyAndAdd({ ref });

    if (looksLikeCipher(t)) return verifyAndAdd({ c: t });

    setErr("รูปแบบข้อมูลไม่ถูกต้อง (วางลิงก์/Ref/หรือสแกน QR)");
  }

  useEffect(() => {
    if (!scanOpen) {
      try {
        controlsRef.current?.stop?.();
      } catch {}
      return;
    }

    let cancelled = false;

    (async () => {
      setScanErr("");
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        const videoEl = videoRef.current;
        if (!videoEl) throw new Error("NO_VIDEO");

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoEl,
          async (result, _error, controlsCb) => {
            if (cancelled) return;
            if (!result) return;

            const raw = result.getText?.() || "";
            const text = clean(raw);
            if (!text) return;

            controlsCb?.stop?.();
            setScanOpen(false);
            await parseTextAndAdd(text);
          },
        );

        controlsRef.current = controls;
      } catch (e) {
        console.error(e);
        setScanErr(
          "เปิดกล้องไม่สำเร็จ (ต้องใช้ https หรือ localhost และอนุญาตกล้องแล้ว)",
        );
      }
    })();

    return () => {
      cancelled = true;
      try {
        controlsRef.current?.stop?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanOpen]);

  if (loadingMe) {
    return (
      <div className="min-h-screen bg-[#F6F8FC] text-slate-900 flex items-center justify-center">
        กำลังโหลด…
      </div>
    );
  }

  const restaurantName = me?.restaurant?.name || "-";

  return (
    <div className="min-h-screen bg-[#F6F8FC] text-slate-900">
      <div className="h-24 bg-gradient-to-r from-[#2B6CFF] via-[#66CCFF] to-[#F6B73C]" />

      <div className="-mt-14 px-4 pb-10">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">ร้านค้า</div>
                  <div className="text-lg font-bold">{restaurantName}</div>
                  <div className="text-xs text-slate-500 mt-0.5 break-all">
                    Bill:{" "}
                    <span className="font-semibold text-slate-700">
                      {billCode}
                    </span>
                  </div>
                  {billMeta ? (
                    <div className="mt-1 text-xs text-slate-500">
                      {billMeta.courseName} • {billMeta.roomName} •{" "}
                      {billMeta.dayYMD}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    className="rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-sm font-semibold"
                    onClick={() => router.push("/m/dashboard")}
                  >
                    Dashboard
                  </button>
                  <button
                    className="rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 text-sm font-semibold disabled:opacity-60"
                    onClick={() => setScanOpen(true)}
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

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  className="rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-4 text-left disabled:opacity-60"
                  onClick={() => setScanOpen(true)}
                  disabled={done}
                >
                  <div className="text-sm font-bold">
                    📷 สแกน QR เพื่อเพิ่มคูปอง
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    แนะนำให้ใช้สแกนเป็นหลัก (แม่นสุด)
                  </div>
                </button>

                <PasteOrRefBox
                  disabled={done || adding}
                  onAdd={(text) => parseTextAndAdd(text)}
                />
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    คูปองในบิลนี้ ({rows.length})
                  </div>
                  {!rows.length ? (
                    <div className="text-xs text-slate-500">เพิ่มคูปองก่อน</div>
                  ) : null}
                </div>

                {rows.length ? (
                  <div className="max-h-[36dvh] overflow-y-auto overscroll-contain divide-y">
                    {rows.map((r) => (
                      <div
                        key={r.key}
                        className="px-4 py-3 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold break-all">
                            Ref. {r.item?.displayCode || "-"}{" "}
                            <span className="ml-2 text-xs text-slate-500">
                              ({r.item?.couponPrice ?? 180}฿)
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {r.item?.holderName || "-"} •{" "}
                            {r.item?.courseName || "-"} •{" "}
                            {r.item?.roomName || "-"}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            dayYMD: {r.item?.dayYMD || "-"}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={
                              clean(r.item?.status) === "redeemed"
                                ? "text-xs font-semibold rounded-full px-2 py-1 bg-emerald-100 text-emerald-700"
                                : "text-xs font-semibold rounded-full px-2 py-1 bg-blue-100 text-blue-700"
                            }
                          >
                            {r.item?.status || "-"}
                          </span>

                          {!done ? (
                            <button
                              className="text-xs font-semibold rounded-xl border border-slate-200 px-2 py-1 hover:bg-slate-50"
                              onClick={() => removeRow(r.key)}
                            >
                              เอาออก
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-slate-500 text-sm">
                    ยังไม่มีคูปองในบิลนี้
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">ยอดคูปองรวม</div>
                    <div className="text-xl font-extrabold">
                      {fmtMoney(couponTotal)} บาท
                    </div>
                  </div>

                  <div className="md:col-span-2 rounded-2xl bg-white border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">
                      ยอดบิลรวม (บาท)
                    </div>
                    <input
                      inputMode="numeric"
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none text-lg focus:ring-2 focus:ring-[#66CCFF]/60 focus:border-[#66CCFF]"
                      value={billTotalText}
                      onChange={(e) => setBillTotalText(e.target.value)}
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
                  onClick={confirmBill}
                  className="mt-4 w-full rounded-2xl bg-[#2B6CFF] hover:bg-[#255DE0] text-white px-4 py-3 font-semibold disabled:opacity-60"
                >
                  {adding
                    ? "กำลังยืนยัน..."
                    : done
                      ? "ยืนยันแล้ว"
                      : "ยืนยันใช้คูปอง (ตัดทั้งบิล)"}
                </button>

                <div className="mt-2 text-xs text-slate-500">
                  * ระบบจะตัดคูปองทุกใบในบิลนี้พร้อมกัน และคำนวณ “จ่ายเพิ่ม” จาก
                  (ยอดบิลรวม - ยอดคูปองรวม)
                </div>

                {done && receipt ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                    <div className="font-bold text-emerald-800">
                      ✅ ตัดคูปองสำเร็จ
                    </div>
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
                          receipt.payMore > 0
                            ? "text-red-700"
                            : "text-emerald-700"
                        }
                      >
                        {receipt.payMore > 0 ? "+" : ""}
                        {fmtMoney(receipt.payMore)}
                      </b>
                    </div>
                    <div className="text-slate-500 text-xs mt-1">
                      เวลา: {fmtDateTimeTH(receipt.redeemedAt)}
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        className="flex-1 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 font-semibold"
                        onClick={() => router.push("/m/dashboard")}
                      >
                        กลับ Dashboard
                      </button>
                      <button
                        className="flex-1 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 font-semibold"
                        onClick={() => {
                          setRows([]);
                          rowsRef.current = [];
                          setBillTotalText("");
                          setDone(false);
                          setReceipt(null);
                          setErr("");
                          setBillCode("");
                          initAddedRef.current = new Set();
                          inFlightAddRef.current = new Set();
                        }}
                      >
                        เริ่มบิลใหม่
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
              Tip: ถ้าต้องใช้หลายคูปอง ให้ “สแกนเพิ่ม”
              แล้วค่อยกดยืนยันครั้งเดียว
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-500">
            © 9Expert Training
          </div>
        </div>
      </div>

      {scanOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setScanOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-xl max-h-[90dvh] rounded-3xl bg-white border border-slate-200 shadow-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between shrink-0">
              <div className="text-sm font-semibold">
                สแกน QR เพื่อเพิ่มคูปอง
              </div>
              <button
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-sm font-semibold"
                onClick={() => setScanOpen(false)}
              >
                ปิด
              </button>
            </div>

            <div className="p-4 overflow-y-auto">
              <div className="rounded-2xl overflow-hidden bg-black ring-1 ring-black/10">
                <video
                  ref={videoRef}
                  className="w-full h-[380px] object-cover"
                  muted
                  playsInline
                />
              </div>

              {scanErr ? (
                <div className="mt-3 text-sm text-red-600">{scanErr}</div>
              ) : (
                <div className="mt-3 text-sm text-slate-600">
                  นำ QR ของคูปองมาไว้ในกรอบ ระบบจะเพิ่มให้อัตโนมัติ
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  className="flex-1 rounded-2xl bg-[#2B6CFF] hover:bg-[#255DE0] text-white px-4 py-3 font-semibold"
                  onClick={() => window.location.reload()}
                >
                  รีเฟรชกล้อง
                </button>
                <button
                  className="flex-1 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-3 font-semibold"
                  onClick={() => setScanOpen(false)}
                >
                  กลับ
                </button>
              </div>

              <div className="mt-2 text-xs text-slate-500">
                * แนะนำเปิดผ่าน https (หรือ localhost)
                เพื่อให้กล้องทำงานบนมือถือได้
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PasteOrRefBox({ disabled, onAdd }) {
  const [text, setText] = useState("");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-bold">วางลิงก์ / Ref (สำรอง)</div>
      <div className="text-xs text-slate-500 mt-1">
        วางลิงก์ /m/redeem?c=..., วางลิงก์ /coupon/..., หรือพิมพ์ Ref เช่น
        9XP4364
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#66CCFF]/60 focus:border-[#66CCFF]"
          placeholder="วางลิงก์หรือ Ref"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => {
            const v = clean(text);
            if (!v) return;
            onAdd?.(v);
            setText("");
          }}
          disabled={disabled}
          className="rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 font-semibold disabled:opacity-60"
        >
          เพิ่ม
        </button>
      </div>
    </div>
  );
}
