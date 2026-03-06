// src/app/m/login/MerchantLoginClient.jsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function pick(sp, key) {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

function safeReturnTo(path, fallback = "/m/dashboard") {
  const s = String(path || "").trim();
  if (!s) return fallback;
  if (!s.startsWith("/")) return fallback;
  if (s.startsWith("//")) return fallback;
  return s;
}

export default function MerchantLoginClient({ searchParams }) {
  const router = useRouter();
  const next = useMemo(
    () => safeReturnTo(pick(searchParams, "next"), "/m/dashboard"),
    [searchParams],
  );

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/merchant/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || "LOGIN_FAILED");
      router.replace(next);
    } catch (e2) {
      setErr(String(e2?.message || "LOGIN_FAILED"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F8FC] text-slate-900">
      {/* header gradient (ธีมเดียวกับ register/coupon) */}
      <div className="h-24 bg-gradient-to-r from-[#2B6CFF] via-[#66CCFF] to-[#F6B73C]" />

      <div className="-mt-14 px-4 pb-10">
        <div className="mx-auto max-w-md">
          {/* Brand header */}
          <div className="flex items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center">
              <img
                src="/logo-9expert-app.png"
                alt="9Expert Training"
                className="h-8 w-auto"
              />
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-slate-700">
                Merchant
              </div>
              <div className="text-xs text-slate-500">
                ระบบร้านค้าสำหรับสแกนคูปอง
              </div>
            </div>
          </div>

          {/* Card */}
          <div className="mt-4 rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-6">
              <h1 className="text-lg font-bold">Merchant Login</h1>
              <p className="text-sm text-slate-500 mt-1">
                เข้าสู่ระบบร้านค้าเพื่อสแกนและยืนยันการใช้คูปอง
              </p>

              <form onSubmit={onSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Username
                  </label>
                  <input
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#66CCFF]/60 focus:border-[#66CCFF]"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="username"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <input
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#66CCFF]/60 focus:border-[#66CCFF]"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="password"
                  />
                </div>

                {err ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {err}
                  </div>
                ) : null}

                <button
                  disabled={busy}
                  className="w-full rounded-2xl bg-[#2B6CFF] hover:bg-[#255DE0] text-white px-4 py-3 font-semibold disabled:opacity-60"
                >
                  {busy ? "Signing in..." : "Sign in"}
                </button>

                {/* Helper text */}
                {/* <div className="text-xs text-slate-500 text-center">
                  หลังล็อกอินสำเร็จ ระบบจะพาไปที่{" "}
                  <span className="font-semibold">/m/dashboard</span>{" "}
                  หรือหน้าที่กำหนดไว้
                </div> */}
              </form>
            </div>

            {/* bottom subtle bar */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
              <div className="text-xs text-slate-500">
                ปัญหาเข้าใช้ไม่ได้ให้ติดต่อแอดมิน 9Expert
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-500">
            © 9Expert Training
          </div>
        </div>
      </div>
    </div>
  );
}
