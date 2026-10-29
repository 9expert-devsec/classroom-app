"use client";

// ลิงก์ Merchant บนหน้าแอดมินร้านอาหาร — ปุ่มเล็กบนหัวหน้า + modal
//   MerchantPickerButton : หน้ารายการร้าน — ลิงก์หน้าเลือกร้าน /m/<key>
//   MerchantShopButton   : หน้ารายละเอียดร้าน — ลิงก์ร้าน /m/<key>/<id> หรือเหตุผลที่ร้านไม่อยู่ใน Merchant
// URL ทั้งหมดมาจาก /api/admin/food/merchant-links (key อยู่ที่ server เท่านั้น)
// 401/403 -> ไม่แสดงปุ่ม (ผู้ใช้ไม่มีสิทธิ์จัดการร้าน)
// ข้อความบนจอแสดง key แบบปิดกลาง — URL เต็มใช้เฉพาะตอนคัดลอก / เปิด / วาด QR
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { Copy, ExternalLink, Link2, QrCode } from "lucide-react";

import { Modal } from "@/components/admin/lunch/LunchModals";
import { copyText } from "../../lunch-orders/_components/QrLinkModal";

// เหมือนปุ่ม "ตั้งค่าคูปอง"
const HEADER_BTN =
  "inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-admin-border bg-white px-3 text-xs text-admin-text shadow-sm transition hover:bg-admin-surfaceMuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/70";
const BTN =
  "inline-flex items-center gap-1.5 rounded-xl border border-admin-border px-4 py-2 text-sm text-admin-text hover:bg-admin-surfaceMuted";

const HINT = "ลิงก์นี้ใช้ติดตั้งบนเครื่องของร้านเท่านั้น ห้ามเผยแพร่สาธารณะ";
const NOT_CONFIGURED = "ยังไม่ได้ตั้งค่า MERCHANT_PATH_KEY";

/** /m/<key>/… -> /m/raMX••••kRaE/… (key สั้นกว่า 9 ตัว -> •••• ทั้งหมด) */
export function maskMerchantUrl(url) {
  return String(url || "").replace(/\/m\/([^/?#]+)/, (_, key) =>
    key.length > 8 ? `/m/${key.slice(0, 4)}••••${key.slice(-4)}` : "/m/••••",
  );
}

function useMerchantLinks(restaurantId, refreshKey) {
  const [state, setState] = useState({ loading: true, data: null, hidden: false, error: "" });

  useEffect(() => {
    let cancelled = false;
    const qs = restaurantId ? `?restaurantId=${encodeURIComponent(restaurantId)}` : "";
    fetch(`/api/admin/food/merchant-links${qs}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          setState({ loading: false, data: null, hidden: true, error: "" });
        } else if (!res.ok) {
          setState({ loading: false, data: null, hidden: false, error: data?.error || "โหลดลิงก์ไม่สำเร็จ" });
        } else {
          setState({ loading: false, data, hidden: false, error: "" });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, data: null, hidden: false, error: "โหลดลิงก์ไม่สำเร็จ" });
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId, refreshKey]);

  return state;
}

function Muted({ children }) {
  return <p className="mt-3 text-sm text-admin-textMuted">{children}</p>;
}

/** url = URL เต็ม (ไม่แสดงเป็นข้อความ) */
function LinkBody({ url, testId }) {
  const [copied, setCopied] = useState("");
  const [showQr, setShowQr] = useState(false);

  async function onCopy() {
    const ok = await copyText(url);
    setCopied(ok ? "คัดลอกลิงก์แล้ว" : "คัดลอกไม่สำเร็จ");
  }

  return (
    <>
      <p
        className="mt-3 break-all rounded-lg bg-admin-surfaceMuted px-3 py-2 text-xs text-admin-text"
        data-testid={testId}
      >
        {maskMerchantUrl(url)}
      </p>

      {showQr ? (
        <div className="mx-auto mt-4 flex w-fit items-center justify-center rounded-xl bg-white p-4">
          <QRCode value={url} size={260} />
        </div>
      ) : null}

      <p className="mt-3 text-xs text-admin-textMuted">{HINT}</p>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {copied ? <span className="mr-auto text-xs text-admin-textMuted">{copied}</span> : null}
        <button type="button" onClick={() => setShowQr((v) => !v)} className={BTN}>
          <QrCode className="h-4 w-4" />
          {showQr ? "ซ่อน QR" : "QR"}
        </button>
        <button
          type="button"
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          className={BTN}
        >
          <ExternalLink className="h-4 w-4" />
          เปิดลิงก์
        </button>
        <button type="button" onClick={onCopy} className={BTN}>
          <Copy className="h-4 w-4" />
          คัดลอกลิงก์
        </button>
      </div>
    </>
  );
}

function LinkModal({ title, onClose, testId, children }) {
  return (
    <Modal onClose={onClose} testId={testId} wide>
      <h3 className="pr-8 text-base font-semibold text-admin-text">{title}</h3>
      {children}
    </Modal>
  );
}

export function MerchantPickerButton() {
  const { loading, data, hidden, error } = useMerchantLinks("", 0);
  const [open, setOpen] = useState(false);
  if (hidden || loading) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={HEADER_BTN}>
        <Link2 className="h-4 w-4" aria-hidden="true" />
        ลิงก์หน้าเลือกร้าน
      </button>
      {open ? (
        <LinkModal title="ลิงก์หน้าเลือกร้าน" onClose={() => setOpen(false)} testId="merchant-picker-modal">
          {error ? (
            <Muted>{error}</Muted>
          ) : !data?.configured ? (
            <Muted>{NOT_CONFIGURED}</Muted>
          ) : (
            <LinkBody url={data.pickerUrl} testId="merchant-picker-link" />
          )}
        </LinkModal>
      ) : null}
    </>
  );
}

/** refreshKey: เปลี่ยนเมื่อการตั้งค่าคูปองของร้านเปลี่ยน -> โหลดเหตุผล/ลิงก์ใหม่ */
export function MerchantShopButton({ restaurantId, restaurantName, refreshKey }) {
  const { loading, data, hidden, error } = useMerchantLinks(restaurantId, refreshKey);
  const [open, setOpen] = useState(false);
  if (hidden || loading || !restaurantId) return null;

  const ineligible = !error && !data?.eligible;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${HEADER_BTN} ${ineligible ? "text-admin-textMuted" : ""}`}
        data-testid="merchant-shop-button"
      >
        <Link2 className="h-4 w-4" aria-hidden="true" />
        ลิงก์ Merchant
      </button>
      {open ? (
        <LinkModal
          title={`ลิงก์ Merchant — ${restaurantName || "-"}`}
          onClose={() => setOpen(false)}
          testId="merchant-shop-modal"
        >
          {error ? (
            <Muted>{error}</Muted>
          ) : ineligible ? (
            <Muted>
              ร้านนี้ไม่อยู่ในหน้า Merchant — <span data-testid="merchant-reason">{data?.reason}</span>
            </Muted>
          ) : !data?.configured ? (
            <Muted>{NOT_CONFIGURED}</Muted>
          ) : (
            <LinkBody url={data.shopUrl} testId="merchant-shop-link" />
          )}
        </LinkModal>
      ) : null}
    </>
  );
}
