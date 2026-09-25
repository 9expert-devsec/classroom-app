"use client";

// src/app/classroom/login/KioskLoginClient.jsx
// Device label + admin username/password -> POST /api/kiosk/open -> `next`.
// `next` has already been validated on the server (safeKioskNext).
import { useEffect, useState } from "react";

const LABEL_MAX = 40;
const LABEL_STORE_KEY = "kiosk_label";

const ERRORS = {
  label_required: `กรุณากรอกชื่ออุปกรณ์ (1–${LABEL_MAX} ตัวอักษร)`,
  bad_credentials: "Username หรือ Password ไม่ถูกต้อง",
  forbidden: "บัญชีนี้ไม่มีสิทธิ์เปิด kiosk หน้างาน",
  admin_required: "เซสชันแอดมินหมดอายุ กรุณากรอก Username และ Password",
  missing_credentials: "กรอก Username และ Password ให้ครบ",
  network: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่",
  unknown: "เปิด kiosk ไม่สำเร็จ กรุณาลองใหม่",
};

export default function KioskLoginClient({ next, adminName }) {
  const [label, setLabel] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // remember the device label on this tablet (convenience only)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LABEL_STORE_KEY);
      if (saved) setLabel(saved);
    } catch {
      // storage unavailable - just type it
    }
  }, []);

  async function open({ useAdminSession }) {
    if (busy) return;
    setError("");

    const l = label.trim();
    if (!l || l.length > LABEL_MAX) {
      setError(ERRORS.label_required);
      return;
    }

    const body = { label: l };
    if (!useAdminSession) {
      const u = username.trim();
      if (!u || !password) {
        setError(ERRORS.missing_credentials);
        return;
      }
      body.username = u;
      body.password = password;
    }

    setBusy(true);
    let res;
    let data = null;
    try {
      res = await fetch("/api/kiosk/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      data = await res.json().catch(() => null);
    } catch {
      setBusy(false);
      setError(ERRORS.network);
      return;
    }

    if (!res.ok || !data?.ok) {
      setBusy(false);
      setPassword("");
      setError(ERRORS[data?.reason] || ERRORS.unknown);
      return;
    }

    try {
      window.localStorage.setItem(LABEL_STORE_KEY, l);
    } catch {
      // ignore
    }
    // full load so the /classroom layout re-checks the new session
    window.location.assign(next || "/classroom");
  }

  function onSubmit(e) {
    e.preventDefault();
    open({ useAdminSession: false });
  }

  const inputCls =
    "w-full rounded-2xl border border-admin-border bg-white px-4 py-3 text-base outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">
          ชื่ออุปกรณ์ <span className="text-red-500">*</span>
        </span>
        <input
          className={inputCls}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={LABEL_MAX}
          placeholder="เช่น iPad ห้อง 3"
          autoComplete="off"
          disabled={busy}
        />
        <span className="text-xs text-front-textMuted">
          ใช้ระบุเครื่องนี้ในหน้าแอดมิน (ไม่เกิน {LABEL_MAX} ตัวอักษร)
        </span>
      </label>

      {adminName ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-admin-border bg-admin-surfaceMuted/60 p-4">
          <button
            type="button"
            onClick={() => open({ useAdminSession: true })}
            disabled={busy}
            className="w-full rounded-2xl bg-brand-primary px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            เปิด kiosk ในชื่อ {adminName}
          </button>
          <div className="text-center text-xs text-front-textMuted">
            หรือเข้าสู่ระบบด้วยบัญชีอื่นด้านล่าง
          </div>
        </div>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Username</span>
        <input
          className={inputCls}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
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
          autoComplete="current-password"
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
        className="w-full rounded-2xl border border-admin-border bg-white px-4 py-3 text-base font-semibold text-admin-text shadow-sm transition hover:bg-admin-surfaceMuted disabled:opacity-60"
      >
        {busy ? "กำลังเปิด…" : "เปิด kiosk"}
      </button>
    </form>
  );
}
