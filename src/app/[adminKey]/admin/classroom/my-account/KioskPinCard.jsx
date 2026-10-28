"use client";

// PIN-P1: การ์ด "PIN สำหรับ Kiosk" ของบัญชีตัวเอง
//   ไม่มี PIN -> สร้าง PIN · มี PIN -> ••••••, แสดง PIN (ขอจาก /reveal ทุกครั้งที่เปิด), สร้าง PIN ใหม่
//   PIN อยู่ใน state เฉพาะตอนเปิดดูเท่านั้น — ปิด / สลับแท็บ / ออกจากหน้า = ลบทิ้ง
import { useCallback, useEffect, useState } from "react";
import { ConfirmModal } from "@/components/admin/lunch/LunchModals";

async function pinApi(url, opts) {
  const res = await fetch(url, { cache: "no-store", ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.reason = data?.reason || "";
    throw err;
  }
  return data;
}

function thDateTime(d) {
  if (!d) return "-";
  return new Date(d).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
}

export default function KioskPinCard({ ui }) {
  const [info, setInfo] = useState(null); // { hasPin, setAt }
  const [shownPin, setShownPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [modalErr, setModalErr] = useState("");

  const load = useCallback(async () => {
    try {
      setErr("");
      const data = await pinApi("/api/admin/me/kiosk-pin");
      setInfo({ hasPin: !!data.hasPin, setAt: data.setAt || null });
    } catch (e) {
      setErr(e.message || "โหลดข้อมูล PIN ไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ซ่อน PIN เมื่อสลับแท็บ / พับจอ
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") setShownPin("");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  async function toggleShow() {
    if (shownPin) {
      setShownPin("");
      return;
    }
    try {
      setBusy(true);
      setErr("");
      const data = await pinApi("/api/admin/me/kiosk-pin/reveal", { method: "POST" });
      setShownPin(String(data.pin || ""));
    } catch (e) {
      setErr(e.message || "แสดง PIN ไม่สำเร็จ");
      if (e.reason === "no_pin") load();
    } finally {
      setBusy(false);
    }
  }

  function openModal() {
    setPassword("");
    setModalErr("");
    setModalOpen(true);
  }

  async function regenerate() {
    if (!password) {
      setModalErr("กรุณากรอกรหัสผ่านปัจจุบัน");
      return;
    }
    try {
      setBusy(true);
      setModalErr("");
      const data = await pinApi("/api/admin/me/kiosk-pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: password }),
      });
      setPassword("");
      setModalOpen(false);
      setInfo({ hasPin: true, setAt: data.setAt || null });
      setShownPin(String(data.pin || ""));
    } catch (e) {
      setModalErr(e.message || "สร้าง PIN ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const hasPin = !!info?.hasPin;

  return (
    <div className={`${ui.card} mt-4`} data-testid="kiosk-pin-card">
      <div className="text-sm font-semibold">PIN สำหรับ Kiosk</div>
      <div className="mt-1 text-xs text-admin-text/60">
        ใช้ PIN 6 หลักนี้เข้าใช้งานแท็บเล็ตหน้างาน · ห้ามบอก PIN กับผู้อื่น
      </div>

      {err ? (
        <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      {!info ? (
        <div className="mt-3 text-sm text-admin-text/60">Loading...</div>
      ) : hasPin ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div
            data-testid="kiosk-pin-value"
            className="rounded-2xl border border-admin-border/30 bg-white px-4 py-2 font-mono text-2xl font-bold tracking-[0.3em] text-admin-text tabular-nums"
          >
            {shownPin || "••••••"}
          </div>
          <div className="text-xs text-admin-text/60">ตั้งเมื่อ {thDateTime(info.setAt)}</div>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={toggleShow} disabled={busy} className={ui.btnGhost}>
              {shownPin ? "ซ่อน PIN" : "แสดง PIN"}
            </button>
            <button type="button" onClick={openModal} disabled={busy} className={ui.btnGhost}>
              สร้าง PIN ใหม่
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <div className="text-sm text-admin-text/60">ยังไม่มี PIN</div>
          <button type="button" onClick={openModal} disabled={busy} className={ui.btnPrimary}>
            สร้าง PIN
          </button>
        </div>
      )}

      {modalOpen ? (
        <ConfirmModal
          testId="kiosk-pin-modal"
          title={hasPin ? "สร้าง PIN ใหม่" : "สร้าง PIN"}
          confirmLabel={hasPin ? "สร้าง PIN ใหม่" : "สร้าง PIN"}
          busyLabel="กำลังสร้าง…"
          busy={busy}
          error={modalErr}
          onClose={() => {
            setPassword("");
            setModalOpen(false);
          }}
          onConfirm={regenerate}
        >
          {hasPin ? (
            <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
              PIN เดิมจะใช้ไม่ได้ทันทีที่สร้าง PIN ใหม่
            </p>
          ) : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              regenerate();
            }}
          >
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-admin-text">รหัสผ่านปัจจุบัน</span>
              <input
                type="password"
                autoComplete="current-password"
                autoFocus
                className={ui.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </label>
          </form>
        </ConfirmModal>
      ) : null}
    </div>
  );
}
