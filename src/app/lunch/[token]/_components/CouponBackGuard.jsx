"use client";

// src/app/lunch/[token]/_components/CouponBackGuard.jsx
//
// หน้าคูปอง/ผลลัพธ์ (สั่งแล้ว): ปุ่ม back ของเครื่อง / ปัดย้อนของ iOS ต้องอยู่หน้านี้
// แบบเดียวกับ back-guard ของ Merchant: push history 1 รายการ (URL เดิม + marker)
// back ออกจาก marker -> push คืนทันที จึงไม่ถอยไปหน้าสั่งอาหารที่อยู่ก่อนหน้า
// และจดไว้ในเครื่องว่า token นี้สั่งแล้ว ให้ FlowGuard ของหน้าสั่งอาหารพากลับมาที่นี่ทันที
import { useEffect } from "react";

import { placedFlagKey } from "./FlowGuard";

const HISTORY_MARKER = "lunchCoupon";

function isMarked() {
  return !!window.history.state?.[HISTORY_MARKER];
}

function pushMarker() {
  // state เดิมมี __NA ของ Next อยู่แล้ว -> Next ไม่ไปยุ่ง, ไม่ส่ง url = URL เดิม
  window.history.pushState({ ...window.history.state, [HISTORY_MARKER]: true }, "");
}

export default function CouponBackGuard({ token }) {
  useEffect(() => {
    try {
      window.localStorage.setItem(placedFlagKey(token), "1");
    } catch {
      // storage ใช้ไม่ได้ -> FlowGuard ยังเช็คกับ server ได้
    }
    if (!isMarked()) pushMarker();

    function onPop() {
      if (!isMarked()) pushMarker();
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [token]);

  return null;
}
