"use client";

import { useEffect, useState } from "react";
import LunchQrCode from "@/components/shared/LunchQrCode";
import LunchDeadlineLine from "@/components/shared/LunchDeadlineLine";
import { LUNCH_BUDGET_THB } from "@/lib/lunchConfig";

/**
 * Step 3 บนแท็บเล็ต: QR ให้ผู้เรียนสแกนไปสั่งอาหารบนมือถือ
 *
 * เกณฑ์ว่าจะโชว์หรือไม่ ตัดสินที่ server ล้วน ๆ — ถ้าวันนี้ไม่ได้เลือกคูปอง
 * endpoint จะตอบ reason not_coupon_choice แล้ว component นี้จะไม่ render อะไรเลย
 * (หน้าจอเดิมของตัวเลือกอื่นจึงไม่เปลี่ยน) ความล้มเหลวอื่นทุกแบบแสดงข้อความให้แจ้ง
 * Counter พร้อมเหตุผลจาก server และหยุดการเด้งกลับอัตโนมัติไว้
 */
export default function LunchQrStep({ studentId, classId, onReady, onDone }) {
  const [state, setState] = useState("loading"); // loading | ready | hidden | error
  const [path, setPath] = useState("");
  const [win, setWin] = useState({ deadlineAt: null, phase: "", status: "" });
  const [message, setMessage] = useState("");

  // ไม่มี id ครบ = ไม่มี Step 3 (คำนวณเอา ไม่ต้อง setState ใน effect)
  const missingIds = !studentId || !classId;

  useEffect(() => {
    if (missingIds) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/checkin/lunch-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, classId }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (res.ok && data?.path) {
          setPath(data.path);
          // P4b-0: เส้นตายจริงของใบนี้ + phase ณ ตอนออก (ไม่ใช่ 11:15 ตายตัว)
          setWin({ deadlineAt: data.deadlineAt, phase: data.phase, status: data.status });
          setState("ready");
          return;
        }

        // ไม่ได้เลือกคูปองวันนี้ = ไม่ต้องมี Step 3 เลย (ไม่ใช่ความผิดพลาด)
        if (data?.reason === "not_coupon_choice") {
          setState("hidden");
          return;
        }

        // อย่างอื่นทั้งหมดคือระบบออก QR ไม่ได้ — ไม่โทษผู้เรียน ให้ไปแจ้ง Counter
        // พร้อมเหตุผลจาก server ตัวเล็ก ๆ ให้เจ้าหน้าที่ดูต่อ
        setMessage(
          [data?.error, data?.reason ? `(${data.reason})` : `(HTTP ${res.status})`]
            .filter(Boolean)
            .join(" "),
        );
        setState("error");
      } catch (err) {
        console.error(err);
        if (cancelled) return;
        setMessage("เชื่อมต่อไม่สำเร็จ (network)");
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [studentId, classId, missingIds]);

  // แจ้ง parent ให้หยุดนับถอยหลังกลับหน้าแรก เมื่อมี Step 3 จริง
  useEffect(() => {
    if (state === "ready" || state === "error") onReady?.();
  }, [state, onReady]);

  if (missingIds || state === "loading" || state === "hidden") return null;

  return (
    <div className="mt-6 w-full max-w-md rounded-2xl border border-brand-border bg-white p-5 text-center">
      {state === "ready" ? (
        <>
          <LunchQrCode path={path} size={280} />

          <p className="mt-4 sm:text-xl lg:text-lg font-semibold text-front-text">
            สแกนด้วยมือถือเพื่อสั่งอาหารกลางวัน
          </p>
          <p className="mt-1 sm:text-lg lg:text-base text-front-textMuted">
            งบคูปอง {LUNCH_BUDGET_THB} บาท (ยังไม่รวม VAT ของร้าน)
          </p>
          <LunchDeadlineLine
            deadlineAt={win.deadlineAt}
            phase={win.phase}
            status={win.status}
          />
        </>
      ) : (
        <div data-testid="lunch-qr-error">
          <p className="sm:text-xl lg:text-base font-semibold text-red-600">
            ออก QR สั่งอาหารไม่สำเร็จ กรุณาแจ้งเจ้าหน้าที่ที่ Counter
          </p>
          {message ? (
            <p className="mt-2 sm:text-sm lg:text-xs text-slate-400">{message}</p>
          ) : null}
        </div>
      )}

      <button
        type="button"
        onClick={onDone}
        className="mt-5 w-full rounded-xl bg-brand-primary px-4 py-3 sm:text-xl lg:text-base font-semibold text-[#0D1B2A] hover:opacity-90"
      >
        เสร็จสิ้น
      </button>
    </div>
  );
}
