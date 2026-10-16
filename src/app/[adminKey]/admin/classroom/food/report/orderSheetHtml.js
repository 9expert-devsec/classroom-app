// src/app/[adminKey]/admin/classroom/food/report/orderSheetHtml.js
// C5d: ใบสั่งร้าน (coupon orders) — สร้าง HTML สำหรับพิมพ์ ไม่มี React/DOM เพื่อ render ทดสอบได้
//   - 1 ร้าน = 1 section (ขึ้นหน้าใหม่) : header, สรุปครัว, รายการสั่ง, สั่งที่ร้านเอง, footer
//   - ไม่มีราคา, ไม่มี coupon header / เส้นตัด, ไม่แสดงโค้ดคูปองกระดาษ (stock)
//   - ร้าน e-coupon แสดงรหัส 9XP
//   - นับเฉพาะ ordered / at_shop (cancelled / pending / forfeited ไม่อยู่ใน sheet)

import { optionGroupsOf } from "@/lib/lunchOptionGroups";

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

export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * 1 บล็อกต่อ 1 บรรทัดที่สั่ง: "<qty>× <เมนู>" (ตัวหนา) แล้วตัวเลือก (ย่อหน้า) แล้ว "หมายเหตุ: …"
 * หมายเหตุอยู่ใต้บรรทัดของตัวเอง — ร้านรู้ว่าโน้ตไหนเป็นของจานไหน
 */
function lineBlockHtml(l) {
  const qty = Number(l?.qty) || 1;
  const opts = optionGroupsOf(l)
    .map(
      (g) =>
        `<div class="ol-sub">${g.group ? `${esc(g.group)}: ` : ""}${esc(g.values.join(", "))}</div>`,
    )
    .join("");
  const note = String(l?.note || "").trim();
  return `
    <div class="ol">
      <div class="ol-item"><b>${qty}×</b> <b>${esc(l?.name || "-")}</b></div>
      ${opts}
      ${note ? `<div class="ol-sub ol-note"><b>หมายเหตุ:</b> ${esc(note)}</div>` : ""}
    </div>`;
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


/**
 * สรุปเมนูที่ต้องเตรียม: 1 แถวต่อเมนู (จำนวนรวม = ผลรวม qty ของบรรทัดที่สั่งผ่านแอป)
 * หมายเหตุ = "ปกติ ×N" (ไม่มีตัวเลือก — เฉพาะเมื่อมีชุดตัวเลือกด้วย) + ชุดตัวเลือกของเมนูนั้น นับตาม qty
 */
export function menuSummary(orderedRows) {
  const m = new Map();
  for (const r of orderedRows) {
    for (const l of r.lines || []) {
      const name = l?.name || "-";
      const qty = Number(l.qty) || 1;
      const opts = Array.isArray(l?.options) ? l.options.filter(Boolean) : [];
      const x = m.get(name) || { qty: 0, combos: new Map() };
      x.qty += qty;
      if (opts.length) {
        const k = opts.join(", ");
        x.combos.set(k, (x.combos.get(k) || 0) + qty);
      }
      m.set(name, x);
    }
  }
  return [...m.entries()]
    .map(([label, x]) => {
      // "ปกติ ×N" (orders without options) leads only when the menu also has option combos
      const plain = x.qty - [...x.combos.values()].reduce((n, q) => n + q, 0);
      const combos = countsNote(x.combos);
      return { label, qty: x.qty, note: combos && plain > 0 ? `ปกติ ×${plain} · ${combos}` : combos };
    })
    .sort((a, b) => b.qty - a.qty || a.label.localeCompare(b.label, "th"));
}

/** Map(label → n) → "a ×2 · b ×1" (มาก → น้อย), "" เมื่อว่าง */
export function countsNote(map) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "th"))
    .map(([k, n]) => `${k} ×${n}`)
    .join(" · ");
}

const UTENSILS_SVG = `<svg class="sec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`;

/**
 * numbered summary table (page 1 of a sheet): # · item · จำนวนรวม · หมายเหตุ + แถวรวมทั้งหมด
 * @param items [{ label, qty, note }]
 */
export function summaryTableHtml({ num, title, itemHeader, items, icon = false, emptyText = "", showNote = true }) {
  const head = `<h3 class="sec-title">${icon ? UTENSILS_SVG : ""}${num}. ${esc(title)}</h3>`;
  if (!items.length) return `<div class="sum-block">${head}<div class="sub">${esc(emptyText)}</div></div>`;
  const total = items.reduce((n, x) => n + x.qty, 0);
  return `
    <div class="sum-block">
      ${head}
      <div class="sum-wrap">
        <table class="sum-table">
          <colgroup>${
            showNote
              ? `<col style="width:7%" /><col style="width:43%" /><col style="width:14%" /><col style="width:36%" />`
              : `<col style="width:8%" /><col style="width:74%" /><col style="width:18%" />`
          }</colgroup>
          <thead>
            <tr><th class="st-th st-num">#</th><th class="st-th">${esc(itemHeader)}</th><th class="st-th st-qty">จำนวนรวม</th>${showNote ? `<th class="st-th">หมายเหตุ</th>` : ""}</tr>
          </thead>
          <tbody>
            ${items
              .map(
                (x, i) => `
              <tr>
                <td class="st-td st-num">${i + 1}</td>
                <td class="st-td">${esc(x.label)}</td>
                <td class="st-td st-qty">${x.qty}</td>
                ${showNote ? `<td class="st-td st-note">${esc(x.note || "-")}</td>` : ""}
              </tr>`,
              )
              .join("")}
            <tr class="st-total">
              <td class="st-td"></td>
              <td class="st-td">รวมทั้งหมด</td>
              <td class="st-td st-qty">${total}</td>
              ${showNote ? `<td class="st-td"></td>` : ""}
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
}

export const CSS = `
  @page {
    size: A4 portrait;  margin: 10mm 9mm 10mm 17mm;
    @bottom-right {
      content: "หน้า " counter(page);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 9px; color: #6b7280;
    }
  }
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
  .lines div + div { margin-top: 2px; }
  .ol-cell { break-inside: avoid; page-break-inside: avoid; }
  .ol + .ol { border-top: 1px solid #d1d5db; margin-top: 4px; padding-top: 4px; }
  .ol-item { font-size: 13px; line-height: 1.35; }
  .ol-sub { font-size: 12px; line-height: 1.35; padding-left: 16px; }
  .ol-note b { font-weight: 700; }
  .footer { margin-top: 10px; font-size: 12px; font-weight: 700; text-align: right; }
  .empty { margin-top: 40px; text-align: center; font-size: 14px; color: #6b7280; }
  /* page 1 of a shop = header + kitchen summary; the order list starts on the next page */
  .summary-page { break-inside: avoid; page-break-inside: avoid; }
  /* numbered summary tables (page 1) — readable in black & white: borders + bold total row */
  .sum-block { break-inside: avoid; page-break-inside: avoid; }
  .sec-title { display: flex; align-items: center; gap: 6px; font-size: 14px; margin: 16px 0 8px; }
  .sec-icon { width: 16px; height: 16px; flex: none; }
  .sum-wrap { border: 1px solid #9ca3af; border-radius: 8px; overflow: hidden; }
  .sum-table { border-collapse: collapse; }
  .st-th, .st-td { padding: 7px 10px; font-size: 12px; vertical-align: top; text-align: left; word-break: break-word; }
  .st-th { background: #f3f4f6; font-weight: 700; border-bottom: 1px solid #9ca3af; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .st-td { border-top: 1px solid #e5e7eb; }
  .st-num { text-align: right; color: #4b5563; }
  .st-qty { text-align: center; font-weight: 800; font-size: 14px; }
  .st-note { color: #374151; font-size: 11px; }
  .st-total .st-td { background: #e0f2fe; font-weight: 800; border-top: 2px solid #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .summary-page.has-list { break-after: page; page-break-after: always; }
  .head-compact { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; border-bottom: 1px solid #111827; padding-bottom: 4px; margin-bottom: 4px; font-size: 12px; color: #374151; }
  .head-compact b { font-size: 14px; color: #111827; }
  @media print { body { margin: 0; } }
`;

// top of the list pages — so a list page can't be mixed up with another shop / day
export function compactHeaderHtml({ shop, dateYMD, afterHHMM = "" }) {
  return `
    <div class="head-compact">
      <b>${esc(shop?.name || "-")}</b>
      <span>วันที่ ${esc(thaiDate(dateYMD))}</span>
      <span>รายการสั่ง</span>
      ${isHHMM(afterHHMM) ? `<span class="after">เฉพาะออร์เดอร์หลัง ${esc(afterHHMM)} น.</span>` : ""}
    </div>
  `;
}

export function headerHtml({ shop, dateYMD, printedAt, afterHHMM, origin }) {
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
  // coupon lines carry their options inline (no separate add-on / drink) → one numbered table
  const kitchenHtml = summaryTableHtml({
    num: 1,
    title: "สรุปเมนูที่ต้องเตรียม (รวมทั้งหมด)",
    itemHeader: "เมนูอาหาร",
    items: menuSummary(ordered),
    icon: true,
    emptyText: "ไม่มีรายการที่สั่งผ่านแอป",
  });

  const noCheckin = (r) =>
    (r.flags || []).includes("no_checkin")
      ? `<div class="warn">ไม่ได้เช็คอินวันนี้</div>`
      : "";


  // "รายการ" ได้ความกว้างของคอลัมน์หมายเหตุเดิมไปด้วย (หมายเหตุย้ายเข้าไปอยู่ใต้บรรทัดของตัวเอง)
  const orderCols = showCode
    ? `<col style="width:5%" /><col style="width:11%" /><col style="width:18%" /><col style="width:8%" /><col style="width:41%" /><col style="width:7%" /><col style="width:10%" />`
    : `<col style="width:5%" /><col style="width:12%" /><col style="width:20%" /><col style="width:9%" /><col style="width:46%" /><col style="width:8%" />`;

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
            <th class="th">เวลาสั่ง</th>
            ${showCode ? `<th class="th">Code</th>` : ""}
          </tr>
        </thead>
        <tbody>
          ${ordered
            .map((r, i) => {
              const lines = (r.lines || []).map(lineBlockHtml).join("");
              return `
                <tr>
                  <td class="td num">${i + 1}</td>
                  <td class="td">${esc(r.nickname || "-")}</td>
                  <td class="td">${esc(r.studentName || "-")}${noCheckin(r)}</td>
                  <td class="td">${esc(r.orderRoomName || r.roomName || "-")}</td>
                  <td class="td ol-cell">${lines || "-"}</td>
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

  const footerHtml = `
      <div class="footer">
        สั่งผ่านแอป ${ordered.length} · สั่งที่ร้านเอง ${atShop.length} · รวม ${ordered.length + atShop.length}
      </div>`;
  const hasList = ordered.length + atShop.length > 0;

  // page 1: header + kitchen summary · page 2+: compact header, both lists (same order), footer
  return `
    <div class="page summary-page${hasList ? " has-list" : ""}">
      ${headerHtml({ shop, dateYMD, printedAt, afterHHMM, origin })}


      ${kitchenHtml}
      ${hasList ? "" : footerHtml}
    </div>
    ${
      hasList
        ? `
    <div class="page list-page">
      ${compactHeaderHtml({ shop, dateYMD, afterHHMM })}

      <h3>รายการสั่ง (${ordered.length})</h3>
      ${orderListHtml}

      <h3>สั่งที่ร้านเอง (${atShop.length})</h3>
      ${atShopHtml}
      ${footerHtml}
    </div>`
        : ""
    }
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
