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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
        <h1 className="text-lg font-semibold">Merchant Login</h1>
        <p className="text-sm text-white/60 mt-1">
          เข้าสู่ระบบร้านค้าเพื่อใช้คูปอง
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <label className="text-sm text-white/70">Username</label>
            <input
              className="mt-1 w-full rounded-xl bg-black/30 ring-1 ring-white/10 px-3 py-2 outline-none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="text-sm text-white/70">Password</label>
            <input
              className="mt-1 w-full rounded-xl bg-black/30 ring-1 ring-white/10 px-3 py-2 outline-none"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {err ? <div className="text-sm text-red-300">{err}</div> : null}

          <button
            disabled={busy}
            className="w-full rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-3 py-2 font-semibold disabled:opacity-60"
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
