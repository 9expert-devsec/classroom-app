"use client";

// src/app/classroom/StaffGate.jsx
//
// L2b: staff step-up for edit-user, receive/staff/** and lunch-qr.
// While locked, the page content is NOT rendered (unmounted, so no learner data
// stays in the DOM) and an unlock panel is shown instead. The server is the
// authority - the client timer only decides when to ask /api/kiosk/me again.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, Lock, ShieldCheck } from "lucide-react";
import { kioskFetch, KIOSK_STAFF_LOCKED_EVENT } from "@/lib/kioskFetch";

const ERRORS = {
  bad_credentials: "Username หรือ Password ไม่ถูกต้อง",
  admin_required: "บัญชีนี้ไม่มีสิทธิ์ใช้โหมดเจ้าหน้าที่",
  missing: "กรอก Username และ Password ให้ครบ",
  network: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่",
  unknown: "ปลดล็อกไม่สำเร็จ กรุณาลองใหม่",
};

// ask the server again a little after the window should have closed
const RECHECK_GRACE_MS = 1000;

export default function StaffGate({ children, fill = false }) {
  const [state, setState] = useState("loading"); // loading | locked | unlocked
  const [name, setName] = useState("");
  const [until, setUntil] = useState(null);
  const timerRef = useRef(null);

  const applyMe = useCallback((data) => {
    if (data?.staffUnlocked && data?.staffUnlockUntil) {
      setName(data.staffUnlockByName || "");
      setUntil(new Date(data.staffUnlockUntil).getTime());
      setState("unlocked");
    } else {
      setName("");
      setUntil(null);
      setState("locked");
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await kioskFetch("/api/kiosk/me", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      applyMe(res.ok ? data : null);
    } catch {
      // network hiccup: fail closed
      applyMe(null);
    }
  }, [applyMe]);

  // first look
  useEffect(() => {
    refresh();
  }, [refresh]);

  // idle timer: when the known window ends, ask the server (a staff API call
  // may have slid it forward in the meantime)
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (state !== "unlocked" || !until) return undefined;
    const wait = Math.max(0, until - Date.now()) + RECHECK_GRACE_MS;
    timerRef.current = setTimeout(refresh, wait);
    return () => clearTimeout(timerRef.current);
  }, [state, until, refresh]);

  // a staff API answered 403 staff_unlock_required; or the tablet woke up
  useEffect(() => {
    const onLocked = () => applyMe(null);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener(KIOSK_STAFF_LOCKED_EVENT, onLocked);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(KIOSK_STAFF_LOCKED_EVENT, onLocked);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [applyMe, refresh]);

  async function lockNow() {
    try {
      await fetch("/api/kiosk/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "button" }),
      });
    } catch {
      // the menu locks again on load anyway
    }
    window.location.assign("/classroom");
  }

  const rootCls = fill ? "flex h-full min-h-0 flex-col" : "";

  if (state === "loading") {
    return (
      <div className={rootCls}>
        <div className="p-6 text-sm text-front-textMuted">กำลังตรวจสอบสิทธิ์…</div>
      </div>
    );
  }

  if (state === "locked") {
    return (
      <div className={rootCls}>
        <UnlockPanel
          onUnlocked={(data) => applyMe({ ...data, staffUnlocked: true })}
        />
      </div>
    );
  }

  return (
    <div className={rootCls}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span className="truncate">
            โหมดเจ้าหน้าที่ · {name || "-"} · ล็อกอัตโนมัติเมื่อไม่ใช้งาน 5 นาที
          </span>
        </div>
        <button
          type="button"
          onClick={lockNow}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-white px-3 py-1 font-semibold text-amber-900 hover:bg-amber-100"
        >
          <Lock className="h-3.5 w-3.5" />
          ล็อก
        </button>
      </div>
      <div className={fill ? "min-h-0 flex-1" : ""}>{children}</div>
    </div>
  );
}

function UnlockPanel({ onUnlocked }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");

    const u = username.trim();
    if (!u || !password) {
      setError(ERRORS.missing);
      return;
    }

    setBusy(true);
    let res;
    let data = null;
    try {
      res = await kioskFetch("/api/kiosk/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password }),
      });
      data = await res.json().catch(() => null);
    } catch {
      setBusy(false);
      setError(ERRORS.network);
      return;
    }

    setBusy(false);
    setPassword("");
    if (!res.ok || !data?.ok) {
      setError(ERRORS[data?.reason] || ERRORS.unknown);
      return;
    }
    onUnlocked(data);
  }

  const inputCls =
    "w-full rounded-2xl border border-admin-border bg-white px-4 py-3 text-base outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60";

  return (
    <div className="mx-auto w-full max-w-md p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/classroom"
          aria-label="กลับเมนูหน้างาน"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-admin-border bg-white text-admin-text hover:bg-admin-surfaceMuted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold text-admin-text">
            <Lock className="h-5 w-5" />
            สำหรับเจ้าหน้าที่
          </div>
          <div className="text-xs text-admin-textMuted">
            กรอกบัญชีเจ้าหน้าที่เพื่อใช้งานหน้านี้
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Username</span>
          <input
            className={inputCls}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Password</span>
          <input
            className={inputCls}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            disabled={busy}
          />
        </label>

        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-brand-primary px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "กำลังตรวจสอบ…" : "ปลดล็อกโหมดเจ้าหน้าที่"}
        </button>
      </form>
    </div>
  );
}
