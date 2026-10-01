// src/app/lunch/[token]/_components/GateNotice.jsx
//
// หน้าแจ้งของด่านตรวจ (lunchGuards.server) ที่ sub-route ทุกหน้าใช้ร่วมกัน
// คืน null เมื่อผ่านด่าน (OK / PLACED / SHORT) — PLACED / SHORT ให้แต่ละหน้า redirect เอง
import Link from "next/link";
import { X, RefreshCw, Clock, Ban } from "lucide-react";
import {
  LUNCH_GATE,
  EXPIRED_KIND,
  expiredKindOf,
} from "@/lib/lunchGuards.server";
import { NoticeScreen, Shell } from "./Shell";

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
  if (gate === LUNCH_GATE.REPLACED) {
    return (
      <NoticeScreen
        icon={RefreshCw}
        tone="amber"
        title="QR นี้ถูกแทนที่แล้ว"
        body="กรุณาติดต่อเจ้าหน้าที่"
      />
    );
  }
  if (gate === LUNCH_GATE.EXPIRED) {
    return <ExpiredScreen kind={expiredKindOf(session)} />;
  }
  return null;
}

/** แจ้งพร้อมปุ่มกลับ — ใช้กับเมนูที่ไม่พบ / หมดวันนี้ */
export function BackNotice({ icon: Icon = Ban, title, body, href, label }) {
  return (
    <Shell>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
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
    </Shell>
  );
}
