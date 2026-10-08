// src/app/[adminKey]/admin/classroom/food/report/orderSheetHtml.js
// C5d: ใบสั่งร้าน (coupon orders) — สร้าง HTML สำหรับพิมพ์ ไม่มี React/DOM เพื่อ render ทดสอบได้
//   - 1 ร้าน = 1 section (ขึ้นหน้าใหม่) : header, สรุปครัว, รายการสั่ง, สั่งที่ร้านเอง, footer
//   - ไม่มีราคา, ไม่มี coupon header / เส้นตัด, ไม่แสดงโค้ดคูปองกระดาษ (stock)
//   - ร้าน e-coupon แสดงรหัส 9XP
//   - นับเฉพาะ ordered / at_shop (cancelled / pending / forfeited ไม่อยู่ใน sheet)

export const BRAND_LOGO_PATH = "/signature_logo_9expert2026_01-ninebule.png";

// localStorage: เวลาที่พิมพ์ล่าสุดต่อวัน + ร้าน (เฉพาะเบราว์เซอร์นี้) — shopId = restaurantId หรือ "all"
export function orderSheetStorageKey(dateYMD, shopId) {
  return `food:orderSheet:lastPrinted:${dateYMD}:${shopId}`;
}

export function hmBKK(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

export function isHHMM(s) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ""));
}

function thaiDate(dateYMD) {
  const d = new Date(`${dateYMD}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return dateYMD;
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function lineLabel(l) {
  const opts = Array.isArray(l?.options) ? l.options.filter(Boolean) : [];
  return `${l?.name || "-"}${opts.length ? ` · ${opts.join(", ")}` : ""}`;
}

function absUrl(url, origin) {
  const u = String(url || "");
  if (!u) return "";
  if (/^(https?:|data:)/i.test(u)) return u;
  return `${origin || ""}${u.startsWith("/") ? "" : "/"}${u}`;
}

/**
 * แถวของร้านหนึ่ง (ordered / at_shop) หลังกรองเวลา "เฉพาะออร์เดอร์หลัง HH:mm"
 * เวลาเทียบแบบ > HH:mm:00 ของวันนั้น (นาทีเดียวกันอาจซ้ำได้ — ปลอดภัยกว่าตกหล่น)
 */
export function sheetRowsForShop(rows, shopId, dateYMD, afterHHMM) {
  const cutoff = isHHMM(afterHHMM)
    ? new Date(`${dateYMD}T${afterHHMM}:00+07:00`).getTime()
    : null;
  return (rows || [])
    .filter(
      (r) =>
        r?.type === "coupon" &&
        r.couponShopId === shopId &&
        (r.couponState === "ordered" || r.couponState === "at_shop"),
    )
    .filter((r) => {
      if (cutoff == null) return true;
      const t = r.orderedAt ? new Date(r.orderedAt).getTime() : NaN;
      return Number.isFinite(t) && t > cutoff;
    })
    .sort(
      (a, b) =>
        new Date(a.orderedAt || 0).getTime() - new Date(b.orderedAt || 0).getTime(),
    );
}

/** สรุปครัว: จำนวนรวมต่อ เมนู + ตัวเลือก จาก ordered เท่านั้น เรียงมาก → น้อย */
export function kitchenSummary(orderedRows) {
  const m = new Map();
  for (const r of orderedRows) {
    for (const l of r.lines || []) {
      const k = lineLabel(l);
      m.set(k, (m.get(k) || 0) + (Number(l.qty) || 1));
    }
  }
  return [...m.entries()]
    .map(([label, qty]) => ({ label, qty }))
    .sort((a, b) => b.qty - a.qty || a.label.localeCompare(b.label, "th"));
}

const CSS = `
  @page { size: A4 portrait;  margin: 10mm 9mm 10mm 17mm;  }
  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 12px;
    color: #111827;
    margin: 0;
  }
  .page { padding: 0; margin: 0; }
  .page-break { page-break-after: always; break-after: page; height: 0; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  .th, .td { border: 1px solid #111827; padding: 4px 6px; font-size: 12px; vertical-align: top; overflow: hidden; word-break: break-word; }
  .th { background: #f3f4f6; font-weight: 700; text-align: left; }
  .num { text-align: right; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: .5px; }
  .sub { font-size: 10px; color: #6b7280; }
  .warn { font-size: 10px; color: #b91c1c; }
  .head { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #111827; padding-bottom: 8px; }
  .head img.brand { height: 30px; width: auto; }
  .head img.shop { height: 44px; width: 44px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb; }
  .head .titles { flex: 1; min-width: 0; }
  .shop-name { font-size: 18px; font-weight: 800; }
  .meta { font-size: 12px; color: #374151; margin-top: 2px; }
  .after { font-weight: 800; color: #111827; }
  h3 { font-size: 13px; margin: 14px 0 6px; }
  .kitchen .td.qty { width: 70px; text-align: center; font-weight: 800; font-size: 14px; }
  .lines div + div { margin-top: 2px; }
  .footer { margin-top: 10px; font-size: 12px; font-weight: 700; text-align: right; }
  .empty { margin-top: 40px; text-align: center; font-size: 14px; color: #6b7280; }
  @media print { body { margin: 0; } }
`;

function headerHtml({ shop, dateYMD, printedAt, afterHHMM, origin }) {
  const shopLogo = absUrl(shop?.logoUrl, origin);
  return `
    <div class="head">
      <img class="brand" src="${esc(absUrl(BRAND_LOGO_PATH, origin))}" alt="9Expert" />
      ${shopLogo ? `<img class="shop" src="${esc(shopLogo)}" alt="" />` : ""}
      <div class="titles">
        <div class="shop-name">ใบสั่งอาหาร — ${esc(shop?.name || "-")}</div>
        <div class="meta">
          วันที่ ${esc(thaiDate(dateYMD))} • พิมพ์เมื่อ ${esc(hmBKK(printedAt))} น.
          ${isHHMM(afterHHMM) ? ` • <span class="after">เฉพาะออร์เดอร์หลัง ${esc(afterHHMM)} น.</span>` : ""}
        </div>
      </div>
    </div>
  `;
}

function shopSectionHtml({ shop, rows, dateYMD, printedAt, afterHHMM, origin }) {
  const showCode = shop.source === "ecoupon";
  const ordered = rows.filter((r) => r.couponState === "ordered");
  const atShop = rows.filter((r) => r.couponState === "at_shop");
  const kitchen = kitchenSummary(ordered);

  const noCheckin = (r) =>
    (r.flags || []).includes("no_checkin")
      ? `<div class="warn">ไม่ได้เช็คอินวันนี้</div>`
      : "";

  const kitchenHtml = kitchen.length
    ? `
      <table class="kitchen">
        <thead><tr><th class="th">เมนู · ตัวเลือก</th><th class="th" style="width:70px;text-align:center;">จำนวน</th></tr></thead>
        <tbody>
          ${kitchen
            .map(
              (k) =>
                `<tr><td class="td">${esc(k.label)}</td><td class="td qty">×${k.qty}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>`
    : `<div class="sub">ไม่มีรายการที่สั่งผ่านแอป</div>`;

  const orderCols = showCode
    ? `<col style="width:5%" /><col style="width:11%" /><col style="width:18%" /><col style="width:8%" /><col style="width:28%" /><col style="width:13%" /><col style="width:7%" /><col style="width:10%" />`
    : `<col style="width:5%" /><col style="width:12%" /><col style="width:20%" /><col style="width:9%" /><col style="width:32%" /><col style="width:14%" /><col style="width:8%" />`;

  const orderListHtml = ordered.length
    ? `
      <table>
        <colgroup>${orderCols}</colgroup>
        <thead>
          <tr>
            <th class="th num">#</th>
            <th class="th">ชื่อเล่น</th>
            <th class="th">ชื่อ-นามสกุล</th>
            <th class="th">ห้อง</th>
            <th class="th">รายการ</th>
            <th class="th">หมายเหตุถึงร้าน</th>
            <th class="th">เวลาสั่ง</th>
            ${showCode ? `<th class="th">Code</th>` : ""}
          </tr>
        </thead>
        <tbody>
          ${ordered
            .map((r, i) => {
              const lines = (r.lines || [])
                .map((l) => `<div>${esc(lineLabel(l))} ×${Number(l.qty) || 1}</div>`)
                .join("");
              const notes = (r.lines || [])
                .map((l) => String(l.note || "").trim())
                .filter(Boolean)
                .map((n) => `<div>${esc(n)}</div>`)
                .join("");
              return `
                <tr>
                  <td class="td num">${i + 1}</td>
                  <td class="td">${esc(r.nickname || "-")}</td>
                  <td class="td">${esc(r.studentName || "-")}${noCheckin(r)}</td>
                  <td class="td">${esc(r.orderRoomName || r.roomName || "-")}</td>
                  <td class="td lines">${lines || "-"}</td>
                  <td class="td lines">${notes || "-"}</td>
                  <td class="td">${esc(hmBKK(r.orderedAt) || "-")}</td>
                  ${showCode ? `<td class="td mono">${esc(r.code || "-")}</td>` : ""}
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>`
    : `<div class="sub">ไม่มี</div>`;

  const atShopHtml = atShop.length
    ? `
      <table>
        <colgroup>${
          showCode
            ? `<col style="width:5%" /><col style="width:18%" /><col style="width:37%" /><col style="width:20%" /><col style="width:20%" />`
            : `<col style="width:5%" /><col style="width:22%" /><col style="width:48%" /><col style="width:25%" />`
        }</colgroup>
        <thead>
          <tr>
            <th class="th num">#</th>
            <th class="th">ชื่อเล่น</th>
            <th class="th">ชื่อ-นามสกุล</th>
            <th class="th">ห้อง</th>
            ${showCode ? `<th class="th">Code</th>` : ""}
          </tr>
        </thead>
        <tbody>
          ${atShop
            .map(
              (r, i) => `
                <tr>
                  <td class="td num">${i + 1}</td>
                  <td class="td">${esc(r.nickname || "-")}</td>
                  <td class="td">${esc(r.studentName || "-")}${noCheckin(r)}</td>
                  <td class="td">${esc(r.orderRoomName || r.roomName || "-")}</td>
                  ${showCode ? `<td class="td mono">${esc(r.code || "-")}</td>` : ""}
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>`
    : `<div class="sub">ไม่มี</div>`;

  return `
    <div class="page">
      ${headerHtml({ shop, dateYMD, printedAt, afterHHMM, origin })}

      <h3>สรุปสำหรับครัว</h3>
      ${kitchenHtml}

      <h3>รายการสั่ง (${ordered.length})</h3>
      ${orderListHtml}

      <h3>สั่งที่ร้านเอง (${atShop.length})</h3>
      ${atShopHtml}

      <div class="footer">
        สั่งผ่านแอป ${ordered.length} · สั่งที่ร้านเอง ${atShop.length} · รวม ${ordered.length + atShop.length}
      </div>
    </div>
  `;
}

/**
 * @param {{
 *   rows: object[], shops: object[], dateYMD: string,
 *   shopId: string, // restaurantId หรือ "all"
 *   afterHHMM?: string, printedAt?: Date, origin?: string
 * }} args
 * @returns {{ html: string, printedShopIds: string[] }}
 */
export function buildOrderSheetHtml({
  rows,
  shops,
  dateYMD,
  shopId,
  afterHHMM = "",
  printedAt = new Date(),
  origin = "",
}) {
  const chosen = (shops || []).filter((s) => shopId === "all" || s.id === shopId);

  const sections = chosen
    .map((shop) => ({ shop, rows: sheetRowsForShop(rows, shop.id, dateYMD, afterHHMM) }))
    // ร้านเดียว: แสดงหน้าว่างแทนหน้าเปล่า / ทุกร้าน: ข้ามร้านที่ไม่มีออเดอร์ที่ตรงเงื่อนไข
    .filter((x) => x.rows.length > 0);

  let body;
  if (!sections.length) {
    const shop = shopId === "all" ? { name: "ทุกร้าน" } : chosen[0] || { name: "-" };
    body = `
      <div class="page">
        ${headerHtml({ shop, dateYMD, printedAt, afterHHMM, origin })}
        <div class="empty">
          ไม่มีออร์เดอร์ที่ตรงเงื่อนไข${isHHMM(afterHHMM) ? ` (หลัง ${esc(afterHHMM)} น.)` : ""}
        </div>
      </div>`;
  } else {
    body = sections
      .map(
        (x, i) =>
          shopSectionHtml({ shop: x.shop, rows: x.rows, dateYMD, printedAt, afterHHMM, origin }) +
          (i === sections.length - 1 ? "" : `<div class="page-break"></div>`),
      )
      .join("");
  }

  const html = `<!DOCTYPE html>
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <title>ใบสั่งร้าน ${esc(dateYMD)}</title>
    <style>${CSS}</style>
  </head>
  <body>
    ${body}
  </body>
</html>`;

  return { html, printedShopIds: chosen.map((s) => s.id) };
}
