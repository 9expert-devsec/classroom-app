// src/app/lunch/[token]/_components/GateNotice.jsx
//
// หน้าแจ้งของด่านตรวจ (lunchGuards.server) ที่ sub-route ทุกหน้าใช้ร่วมกัน
// คืน null เมื่อผ่านด่าน (OK / PLACED / SHORT) — PLACED / SHORT ให้แต่ละหน้า redirect เอง
import Image from "next/image";
import Link from "next/link";
import { X, Clock, Ban } from "lucide-react";
import {
  LUNCH_GATE,
  EXPIRED_KIND,
  expiredKindOf,
} from "@/lib/lunchGuards.server";
import { NoticeScreen, Shell, LOGO, LOGO_W, LOGO_H } from "./Shell";
import ShellScroll from "./ShellScroll";

// ไอคอน "QR มีกากบาท" (เส้น) — lucide ไม่มีตัวนี้
function QrCancelledIcon() {
  return (
    <svg
      aria-hidden="true"
      width="44"
      height="44"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <path d="M6.5 6.5h.01M17.5 6.5h.01M6.5 17.5h.01" />
      <path d="m15 15 6 6M21 15l-6 6" />
    </svg>
  );
}

/** R4a: QR ถูกยกเลิก (token ถูกแทนที่ด้วย QR ใหม่) — ทริกเกอร์เดิม LUNCH_GATE.REPLACED */
export function CancelledQrScreen() {
  return (
    <Shell>
      <ShellScroll>
        <div
          data-testid="qr-cancelled"
          className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-16 text-center"
        >
          <div
            data-testid="notice-icon"
            className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[#fdecea] text-[#b42318]"
          >
            <QrCancelledIcon />
          </div>
          <h1 className="text-[24px] font-bold text-[color:var(--navy)]">QR นี้ถูกยกเลิกแล้ว</h1>
          <p className="max-w-[300px] text-[15px] leading-relaxed text-[color:var(--gray)]">
            QR นี้ใช้งานไม่ได้แล้ว หากต้องการสั่งอาหาร กรุณาติดต่อเจ้าหน้าที่ที่ Counter
            เพื่อรับ QR ใหม่
          </p>
          <Image
            src={LOGO}
            alt="9Expert"
            width={LOGO_W}
            height={LOGO_H}
            className="mt-4 h-6 w-auto"
          />
        </div>
      </ShellScroll>
    </Shell>
  );
}

/** C1: ถึง 15:00 แล้ว — 2 แบบตามว่าเคยสั่งหรือยัง */
export function ExpiredScreen({ kind }) {
  if (kind === EXPIRED_KIND.FORFEITED) {
    return (
      <NoticeScreen
        icon={Clock}
        tone="red"
        title="คูปองหมดอายุ ไม่สามารถใช้งานได้"
      />
    );
  }
  return (
    <NoticeScreen
      icon={Clock}
      tone="red"
      title="หมดเวลาการใช้งานตามเงื่อนไขของระบบ"
    />
  );
}

export default function GateNotice({ gate, session }) {
  if (gate === LUNCH_GATE.INVALID) {
    return (
      <NoticeScreen
        icon={X}
        tone="red"
        title="QR ไม่ถูกต้อง"
        body="กรุณาตรวจสอบ QR อีกครั้ง หรือติดต่อเจ้าหน้าที่"
      />
    );
  }
  if (gate === LUNCH_GATE.REPLACED) return <CancelledQrScreen />;
  if (gate === LUNCH_GATE.EXPIRED) {
    return <ExpiredScreen kind={expiredKindOf(session)} />;
  }
  return null;
}

/** แจ้งพร้อมปุ่มกลับ — ใช้กับเมนูที่ไม่พบ / หมดวันนี้ */
export function BackNotice({ icon: Icon = Ban, title, body, href, label }) {
  return (
    <Shell>
      <ShellScroll>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200/60 text-slate-500">
            <Icon aria-hidden="true" className="h-8 w-8" />
          </div>
          <h1 className="text-[19px] font-bold text-[#0d1b2a]">{title}</h1>
          {body ? (
            <p className="text-[14px] leading-relaxed text-slate-500">{body}</p>
          ) : null}
          <Link
            href={href}
            replace
            className="h-11 rounded-xl bg-[#2486ff] px-6 text-[15px] font-semibold leading-[44px] text-white shadow-sm"
          >
            {label}
          </Link>
        </div>
      </ShellScroll>
    </Shell>
  );
}
