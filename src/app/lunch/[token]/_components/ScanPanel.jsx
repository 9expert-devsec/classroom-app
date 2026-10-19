"use client";

// src/app/lunch/[token]/_components/ScanPanel.jsx
//
// แผงสแกนของ e-coupon: QR (+ บาร์โค้ด Code 128 ถ้าร้านเปิดไว้) ดำล้วนบนขาวล้วนเสมอ
// ทั้ง dark mode และ light mode — เครื่องสแกนอ่านได้แค่เข้มบนสว่าง
//
// ทำไมเป็นรูป PNG ไม่ใช่ SVG: dark mode แบบบังคับของเบราว์เซอร์ (Samsung Internet, Chrome Auto Dark)
// เปลี่ยนสี fill ของ SVG และพื้นหลัง CSS ได้ ทำให้ QR/บาร์โค้ดเป็นเทาบนเทา สแกนไม่ติด
//   - วาดลง canvas นอกจอ แล้วแสดงเป็น <img src="data:image/png">
//   - quiet zone อยู่ในพิกเซลของรูปเลย (QR 4 โมดูล / บาร์โค้ด 10 โมดูล) ขอบขาวไม่หายแม้กรอบถูกเปลี่ยนสี
//   - วาดที่ความละเอียด devicePixelRatio (อย่างน้อย 2x) แสดงด้วย image-rendering: pixelated ให้ขอบคม
//   - ค่า encode เหมือนเดิม: QR = รหัสเปล่า (qr.js ตัวเดียวกับที่ react-qr-code ใช้, ระดับ L), บาร์โค้ด = รหัสตรงตัว
// ส่วนอื่นของการ์ดยังเป็นไปตาม theme ปกติ — ล็อกเฉพาะแผงนี้
import { useEffect, useState } from "react";
import QRCodeImpl from "qr.js/lib/QRCode";
import ErrorCorrectLevel from "qr.js/lib/ErrorCorrectLevel";
import CouponStamp, { stampFadeClass } from "@/components/shared/CouponStamp";

const QR_QUIET_MODULES = 4;
const BAR_MODULE_CSS_PX = 2;
const BAR_HEIGHT_CSS_PX = 64;
const BAR_QUIET_MODULES = 10;

function renderScale() {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.max(2, Math.ceil(dpr));
}

/** QR -> { src, cssSize } (ระดับ L เหมือน react-qr-code ค่าเริ่มต้น) */
function qrImage(value, targetCss) {
  const qr = new QRCodeImpl(-1, ErrorCorrectLevel.L);
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  const total = n + QR_QUIET_MODULES * 2;
  const scale = renderScale();
  // จำนวนพิกเซลจริงต่อโมดูลเป็นจำนวนเต็ม — ไม่มีขอบเบลอ
  const px = Math.max(1, Math.floor((targetCss * scale) / total));

  const canvas = document.createElement("canvas");
  canvas.width = total * px;
  canvas.height = total * px;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (qr.isDark(r, c)) {
        ctx.fillRect((c + QR_QUIET_MODULES) * px, (r + QR_QUIET_MODULES) * px, px, px);
      }
    }
  }
  return { src: canvas.toDataURL("image/png"), cssSize: canvas.width / scale };
}

/** Code 128 (auto subset) -> { src, cssWidth, cssHeight } */
async function barcodeImage(value) {
  const { default: JsBarcode } = await import("jsbarcode");
  const scale = renderScale();
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, value, {
    format: "CODE128",
    width: BAR_MODULE_CSS_PX * scale,
    height: BAR_HEIGHT_CSS_PX * scale,
    margin: BAR_QUIET_MODULES * BAR_MODULE_CSS_PX * scale,
    displayValue: false,
    background: "#ffffff",
    lineColor: "#000000",
  });
  return {
    src: canvas.toDataURL("image/png"),
    cssWidth: canvas.width / scale,
    cssHeight: canvas.height / scale,
  };
}

const IMG_STYLE = { imageRendering: "pixelated", display: "block", maxWidth: "none" };

function RasterQr({ value, size }) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    let cancelled = false;
    // วาดหลัง mount (ต้องมี document) — แบบเดียวกับบาร์โค้ด
    Promise.resolve().then(() => {
      if (!cancelled) setImg(qrImage(value, size));
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  return (
    <div style={{ width: img?.cssSize ?? size, height: img?.cssSize ?? size }}>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img.src}
          width={img.cssSize}
          height={img.cssSize}
          alt={`QR ${value}`}
          style={IMG_STYLE}
          draggable={false}
        />
      ) : null}
    </div>
  );
}

function RasterBarcode({ value }) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    let cancelled = false;
    // โหลด jsbarcode เฉพาะร้านที่เปิดบาร์โค้ด
    barcodeImage(value).then((r) => {
      if (!cancelled) setImg(r);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div style={{ minHeight: BAR_HEIGHT_CSS_PX }}>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img.src}
          width={img.cssWidth}
          height={img.cssHeight}
          alt={`บาร์โค้ด ${value}`}
          style={IMG_STYLE}
          draggable={false}
        />
      ) : null}
    </div>
  );
}

/**
 * status: "unused" | "used" — used = ภาพจาง (ที่ wrapper ไม่ใช่เปลี่ยนสีรูป) + ตราประทับทับทั้งแผง
 * showBarcode: แสดงบาร์โค้ดใต้ QR
 */
export default function ScanPanel({ value, qrSize = 168, status = "unused", showBarcode = false }) {
  if (!value) return null;
  return (
    <div
      data-testid="scan-panel"
      data-status={status}
      // ล็อกเป็นสว่างเสมอ — ไม่รับ theme / filter / blend จากการ์ด
      style={{
        colorScheme: "light",
        backgroundColor: "#ffffff",
        filter: "none",
        mixBlendMode: "normal",
        isolation: "isolate",
      }}
      className="relative rounded-xl px-1 py-2"
    >
      <div className={`flex flex-col items-center gap-2 ${stampFadeClass(status)}`}>
        <div data-testid="lunch-qr" data-value={value} data-status={status}>
          <RasterQr value={value} size={qrSize} />
        </div>
        {showBarcode ? (
          <div data-testid="coupon-barcode" data-value={value} data-status={status} className="flex flex-col items-center gap-1">
            <RasterBarcode value={value} />
            <p className="text-[12px]" style={{ color: "#4b5563" }}>
              สำหรับเครื่องสแกน POS ของร้าน
            </p>
          </div>
        ) : null}
      </div>
      <CouponStamp status={status} />
    </div>
  );
}
