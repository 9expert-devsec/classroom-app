// src/lib/merchantKey.server.js
//
// C3c: ทางเข้า Merchant (ร้านที่ไม่ใช้คูปอง stock) — ไม่มี login มีแค่ path ที่เดายาก
//   MERCHANT_PATH_KEY = สตริงสุ่มยาว ๆ ที่เจ้าหน้าที่ 9Expert ติดตั้งให้บนเครื่องของร้าน
//   หน้า:  /m/[key]/…            (key ใน path)
//   API:   /api/merchant/lunch/… (header x-merchant-key ที่หน้าเป็นคนส่ง)
// ไม่ได้ตั้ง env หรือ key ไม่ตรง -> 404 เสมอ (ไม่บอกว่ามีหน้านี้อยู่)
// ห้าม log ค่า key ไม่ว่ากรณีใด
import crypto from "node:crypto";
import { NextResponse } from "next/server";

function configuredKey() {
  return String(process.env.MERCHANT_PATH_KEY || "").trim();
}

/** เทียบแบบ timing-safe (hash ก่อน เพื่อให้ความยาวเท่ากันเสมอ) */
export function isValidMerchantKey(candidate) {
  const expected = configuredKey();
  if (!expected) return false;
  const got = String(candidate || "").trim();
  if (!got) return false;
  const a = crypto.createHash("sha256").update(got).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

const NO_STORE = { "Cache-Control": "no-store" };

export function merchantNotFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
}

/** route guard: null = ผ่าน, ไม่งั้นคืน 404 */
export function merchantKeyGuard(req) {
  const key = req?.headers?.get?.("x-merchant-key") || "";
  return isValidMerchantKey(key) ? null : merchantNotFound();
}
