// src/app/[adminKey]/admin/login/AdminLoginClient.jsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function pick(sp, key) {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

// กัน open-redirect: อนุญาตเฉพาะ path ที่ขึ้นต้นด้วย "/"
function safeRedirectPath(x, fallback) {
  const s = String(x || "").trim();
  if (!s.startsWith("/")) return fallback;
  if (s.startsWith("//")) return fallback; // กัน protocol-relative
  return s;
}

export default function AdminLoginClient({
  searchParams = {},
  adminKey = "a1exqwvCqTXP7s0",
}) {
  const router = useRouter();

  const fallback = useMemo(() => `/${adminKey}/admin/classroom`, [adminKey]);

  const redirect = useMemo(() => {
    const raw = pick(searchParams, "redirect");
    return safeRedirectPath(raw, fallback);
  }, [searchParams, fallback]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "เข้าสู่ระบบไม่สำเร็จ");
        setLoading(false);
        return;
      }

      router.push(redirect);
    } catch (err) {
      console.error(err);
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-admin-bg">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-lg font-semibold">9Expert Admin Login</h1>
        <p className="mt-1 text-sm text-gray-500">
          เข้าสู่ระบบเพื่อจัดการ Classroom Dashboard
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs font-medium text-gray-600">
              Username
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/60"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">
              Password
            </label>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/60"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error ? <p className="text-xs text-red-500">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-brand-primary py-2 text-sm font-medium text-white shadow hover:bg-brand-primaryDark disabled:opacity-60"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
}
