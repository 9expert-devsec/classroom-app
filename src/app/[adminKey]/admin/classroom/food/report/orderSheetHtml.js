// src/app/[adminKey]/admin/classroom/food/report/orderSheetHtml.js
// C5d: ใบสั่งร้าน (coupon orders) — สร้าง HTML สำหรับพิมพ์ ไม่มี React/DOM เพื่อ render ทดสอบได้
//   - 1 ร้าน = 1 section (ขึ้นหน้าใหม่) : header, สรุปครัว, รายการสั่ง, สั่งที่ร้านเอง, footer
//   - R5-5: หน้ารายการแบ่งเป็นบล็อกต่อคลาส (หัวคลาส · ห้อง) — ไม่มีคอลัมน์ห้องแล้ว
//   - R5-5a: บล็อกคลาสมีเฉพาะรายการสั่ง · สั่งที่ร้านเอง = ตารางเดียวท้ายร้าน (มีคอลัมน์คลาส)
//   - R5-5b/c: สั่งที่ร้านเอง อยู่ในกล่องพื้นเทา หัวข้อตัวหนา (พิมพ์ขาวดำแยกออก)
//   - R5-5e: บล็อกคลาส = หัวคลาส · "รายการสั่ง (n)" · ตาราง (ไม่มียอดย่อย) · ยอดรวมใช้คำ "สั่งล่วงหน้า"
//   - ไม่มีราคา, ไม่มี coupon header / เส้นตัด, ไม่แสดงโค้ดคูปองกระดาษ (stock)
//   - ร้าน e-coupon แสดงรหัส 9XP
//   - นับเฉพาะ ordered / at_shop (cancelled / pending / forfeited ไม่อยู่ใน sheet)

import { optionGroupsOf } from "@/lib/lunchOptionGroups";
import { cleanClassTitle, printableRows } from "./_components/reportUi";

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
 * 1 บล็อกต่อ 1 บรรทัดที่สั่ง: "<qty>× <เมนู>" แล้วตัวเลือก (ย่อหน้า) แล้ว "หมายเหตุ: …"
 * R5-5a: ชื่อเมนูน้ำหนักปกติ — จำนวน "1×" กึ่งหนา (.ol-qty) ให้อ่านง่าย
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
      <div class="ol-item"><span class="ol-qty">${qty}×</span> ${esc(l?.name || "-")}</div>
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
  // R4-6: ตัวกรองเดียวกับทุกทางพิมพ์/Export (ยังไม่เลือก / ไม่มีข้อมูล ไม่ออกในเอกสาร)
  return printableRows(rows)
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
 * ไม่มีคอลัมน์หมายเหตุแล้ว (r2c) — ตัวเลือก/หมายเหตุของแต่ละจานอยู่ในตาราง "รายการสั่ง" ใต้บรรทัดของตัวเอง
 */
export function menuSummary(orderedRows) {
  const m = new Map();
  for (const r of orderedRows) {
    for (const l of r.lines || []) {
      const name = l?.name || "-";
      m.set(name, (m.get(name) || 0) + (Number(l.qty) || 1));
    }
  }
  return [...m.entries()]
    .map(([label, qty]) => ({ label, qty }))
    .sort((a, b) => b.qty - a.qty || a.label.localeCompare(b.label, "th"));
}

/**
 * R5-5: แบ่งแถวของร้านตามคลาส (classId) — เรียงตามเวลาเริ่มคลาส แล้วชื่อคลาส
 * ลำดับแถวในกลุ่มคงตามที่ส่งเข้ามา (เวลาสั่ง)
 * @returns [{ key, name, courseCode, room, startTime, rows }]
 */
export function groupRowsByClass(rows) {
  const groups = new Map();
  for (const r of rows) {
    // key / ชื่อ เหมือนการ์ดคลาสในรายงาน (ClassGroupedTable) — ชื่อตัดรหัสหลักสูตรนำหน้าออก แล้วแสดงรหัสในวงเล็บ
    const key = r.classId || r.className || "unknown";
    let g = groups.get(key);
    if (!g) {
      const raw = String(r.className || r.classTitle || "").trim();
      g = {
        key,
        name: raw ? cleanClassTitle(raw, r.courseCode) : "ไม่ระบุ Class",
        courseCode: r.courseCode || "",
        room: r.roomName || "",
        startTime: isHHMM(r.classStartTime) ? r.classStartTime : "",
        rows: [],
      };
      groups.set(key, g);
    }
    // คลาสไม่มีห้อง: ใช้ห้องที่ผู้เรียนเลือกตอนสั่ง
    if (!g.room && r.orderRoomName) g.room = r.orderRoomName;
    g.rows.push(r);
  }
  return [...groups.values()].sort(
    (a, b) =>
      // ไม่มีเวลาเริ่ม -> ไว้ท้าย
      (a.startTime || "99:99").localeCompare(b.startTime || "99:99") ||
      a.name.localeCompare(b.name, "th") ||
      a.key.localeCompare(b.key),
  );
}

/** R5-5f: หัวบล็อกคลาส "<ชื่อคลาส> (<รหัสหลักสูตร>) · ห้อง <ห้อง>" — ใช้ทั้งใบสั่งร้านคูปองและร้าน Set */
export function classHeadHtml(g) {
  return `
        <div class="class-head">
          <b>${esc(g.name)}</b>${g.courseCode ? ` <span class="class-code">(${esc(g.courseCode)})</span>` : ""}
          · ห้อง ${esc(g.room || "-")}
        </div>`;
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
  /* R5-5c: separate borders (not collapse) — collapse paints half of each outer border outside the
     table box and Chrome's PDF dropped it (no line under the last row in the panel, no right edge on
     tables touching the page edge). Here every line is inside a box: table = top + left, cell = right
     + bottom; width -2px keeps the right edge off the page edge. */
  table { width: calc(100% - 2px); box-sizing: border-box; border-collapse: separate; border-spacing: 0; table-layout: fixed;
    border-top: 1px solid #111827; border-left: 1px solid #111827; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  .th, .td { border: 0; border-right: 1px solid #111827; border-bottom: 1px solid #111827; padding: 4px 6px; font-size: 12px; vertical-align: top; overflow: hidden; word-break: break-word; }
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
  .ol-qty { font-weight: 600; }
  .ol-sub { font-size: 12px; line-height: 1.35; padding-left: 16px; }
  .ol-note b { font-weight: 700; }
  .code { white-space: nowrap; word-break: normal; }
  /* R5-5: 1 บล็อกต่อคลาส — ไม่ตัดหน้ากลางบล็อก (ถ้าบล็อกยาวเกินหน้า เบราว์เซอร์ตัดเองและ thead ซ้ำหัวตาราง) */
  .class-block { break-inside: avoid; page-break-inside: avoid; margin-top: 14px; }
  .class-block + .class-block { border-top: 1px dashed #9ca3af; padding-top: 10px; }
  .class-head { font-size: 14px; color: #111827; }
  .class-head .class-code { font-weight: 400; color: #374151; }
  .class-block h3 { margin: 8px 0 4px; }
  /* R5-5b/c: สั่งที่ร้านเอง — แยกจากบล็อกคลาสให้ชัดแม้พิมพ์ขาวดำ:
     ระยะห่าง ~2 เท่า + เส้นทึบ 2px, กล่องพื้นเทา, หัวข้อตัวหนา, หัวตารางเทากลาง, แถวพื้นขาว */
  .atshop { break-inside: avoid; page-break-inside: avoid; margin-top: 28px; padding-top: 20px; border-top: 2px solid #111827; }
  .atshop-panel, .atshop-table th, .atshop-table td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .atshop-panel { background: #f3f4f6; border: 1px solid #6b7280; border-radius: 6px; padding: 8px; }
  /* R5-5c: หัวข้อตัวหนาธรรมดา (ไม่มีแถบดำ) ใหญ่กว่า "รายการสั่ง (n)" (13px) หนึ่งขั้น */
  .atshop-title { font-size: 15px; font-weight: 700; color: #111827; padding: 0 2px; }
  .atshop-note { margin: 6px 2px; font-size: 11px; color: #4b5563; }
  .atshop-table .th { background: #d1d5db; }
  .atshop-table .td { background: #fff; }
  /* R5-5f: same width as the tables (100% - 2px) + inner padding — text used to end exactly on the
     page's content edge, so the last glyph ("ที่") could be clipped there in print */
  .footer { width: calc(100% - 2px); box-sizing: border-box; padding-right: 4px; margin-top: 10px; font-size: 12px; font-weight: 700; text-align: right; }
  .empty { margin-top: 40px; text-align: center; font-size: 14px; color: #6b7280; }
  /* page 1 of a shop = header + kitchen summary; the order list starts on the next page */
  .summary-page { break-inside: avoid; page-break-inside: avoid; }
  /* numbered summary tables (page 1) — readable in black & white: borders + bold total row */
  .sum-block { break-inside: avoid; page-break-inside: avoid; }
  .sec-title { display: flex; align-items: center; gap: 6px; font-size: 14px; margin: 16px 0 8px; }
  .sec-icon { width: 16px; height: 16px; flex: none; }
  .sum-wrap { border: 1px solid #9ca3af; border-radius: 8px; overflow: hidden; }
  .sum-table { width: 100%; border: 0; border-collapse: collapse; }
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
  const ordered = rows.filter((r) => r.couponState === "ordered");
  const atShop = rows.filter((r) => r.couponState === "at_shop");
  // ร้าน stock ที่ออก e-coupon แทนตอนกระดาษหมด: แสดงโค้ดเฉพาะแถว e-coupon (ไม่แสดงโค้ดกระดาษ)
  const isECouponRow = (r) => shop.source === "ecoupon" || r.couponSource === "ecoupon";
  const showCode = [...ordered, ...atShop].some(isECouponRow);
  const codeOf = (r) => (isECouponRow(r) ? r.code || "-" : "-");
  // coupon lines carry their options inline (no separate add-on / drink) → one numbered table
  const kitchenHtml = summaryTableHtml({
    num: 1,
    title: "สรุปเมนูที่ต้องเตรียม (รวมทั้งหมด)",
    itemHeader: "เมนูอาหาร",
    items: menuSummary(ordered),
    icon: true,
    emptyText: "ไม่มีรายการสั่งล่วงหน้า",
    // 3 คอลัมน์: # · เมนูอาหาร (ได้ความกว้างของหมายเหตุเดิม) · จำนวนรวม
    showNote: false,
  });

  const noCheckin = (r) =>
    (r.flags || []).includes("no_checkin")
      ? `<div class="warn">ไม่ได้เช็คอินวันนี้</div>`
      : "";

  // R5-5: คอลัมน์ Code ไม่ตัดบรรทัด กว้างพอสำหรับรหัสที่ยาวที่สุดของร้านนี้ (mono: 1ch ต่อตัว + letter-spacing)
  //       คอลัมน์ที่ไม่ระบุความกว้าง (รายการ / ชื่อ-นามสกุล) ได้พื้นที่ที่เหลือ
  // R5-5a: + ช่องว่างเพิ่ม (~ +35% จาก R5-5 สำหรับรหัส 8 ตัว) ใช้ทั้ง 2 ตาราง
  const codeLen = Math.max(4, ...[...ordered, ...atShop].map((r) => String(codeOf(r)).length));
  const codeCol = showCode ? `<col style="width:calc(${codeLen}ch + ${codeLen * 0.5 + 40}px)" />` : "";
  const codeTh = showCode ? `<th class="th code">Code</th>` : "";
  const codeTd = (r) => (showCode ? `<td class="td mono code">${esc(codeOf(r))}</td>` : "");

  // "รายการ" ได้ความกว้างของคอลัมน์หมายเหตุเดิมไปด้วย (หมายเหตุย้ายเข้าไปอยู่ใต้บรรทัดของตัวเอง)
  const orderTableHtml = (list) => `
      <table>
        <colgroup><col style="width:5%" /><col style="width:12%" /><col style="width:20%" /><col /><col style="width:8%" />${codeCol}</colgroup>
        <thead>
          <tr>
            <th class="th num">#</th>
            <th class="th">ชื่อเล่น</th>
            <th class="th">ชื่อ-นามสกุล</th>
            <th class="th">รายการ</th>
            <th class="th">เวลาสั่ง</th>
            ${codeTh}
          </tr>
        </thead>
        <tbody>
          ${list
            .map((r, i) => {
              const lines = (r.lines || []).map(lineBlockHtml).join("");
              return `
                <tr>
                  <td class="td num">${i + 1}</td>
                  <td class="td">${esc(r.nickname || "-")}</td>
                  <td class="td">${esc(r.studentName || "-")}${noCheckin(r)}</td>
                  <td class="td ol-cell">${lines || "-"}</td>
                  <td class="td">${esc(hmBKK(r.orderedAt) || "-")}</td>
                  ${codeTd(r)}
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>`;

  // R5-5e: "สั่งล่วงหน้า" = สั่งผ่านแอป (ordered)
  const countsText = (a, b) => `สั่งล่วงหน้า ${a} · สั่งที่ร้านเอง ${b} · รวม ${a + b}`;

  // ลำดับคลาสเดียวกันทั้งบล็อกรายการสั่งและตารางสั่งที่ร้านเอง
  const classGroups = groupRowsByClass([...ordered, ...atShop]);

  // R5-5 / R5-5a / R5-5e: 1 บล็อกต่อคลาส — หัวคลาส, "รายการสั่ง (n)", ตาราง (ไม่มียอดย่อย)
  //   เฉพาะสั่งล่วงหน้า (ordered) · คลาสที่ไม่มีรายการสั่งไม่มีบล็อก
  const classBlocksHtml = classGroups
    .map((g) => {
      const o = g.rows.filter((r) => r.couponState === "ordered");
      if (!o.length) return "";
      return `
      <section class="class-block">${classHeadHtml(g)}
        <h3>รายการสั่ง (${o.length})</h3>${orderTableHtml(o)}
      </section>`;
    })
    .join("");

  // R5-5a: "สั่งที่ร้านเอง" ตารางเดียวทั้งร้าน ต่อท้ายบล็อกคลาส — คอลัมน์ คลาส = รหัสหลักสูตร (ไม่มี -> ชื่อคลาส)
  //        เรียงตามลำดับคลาสแล้วเวลาสั่ง · เลข 1..n ต่อเนื่องทั้งตาราง
  const atShopRows = classGroups.flatMap((g) =>
    g.rows.filter((r) => r.couponState === "at_shop").map((r) => ({ r, cls: g.courseCode || g.name })),
  );
  // ความกว้างคอลัมน์คลาสตามป้ายที่ยาวที่สุด (สูงสุด 24 ตัว — ชื่อคลาสยาวกว่านั้นตัดบรรทัดได้)
  // ×1.3: ตัวพิมพ์ใหญ่ละตินกว้างกว่า 1ch · ป้ายไม่เกิน 24 ตัว (รหัสหลักสูตร) ไม่ตัดบรรทัด
  const CLS_MAX = 24;
  const clsLen = Math.min(CLS_MAX, Math.max(4, ...atShopRows.map((x) => x.cls.length)));
  const clsTd = (cls) =>
    `<td class="td${cls.length <= CLS_MAX ? " code" : ""}">${esc(cls)}</td>`;
  const atShopHtml = atShopRows.length
    ? `
      <section class="atshop">
       <div class="atshop-panel">
        <div class="atshop-title">สั่งที่ร้านเอง · ${atShopRows.length} คน</div>
        <div class="atshop-note">ลูกค้าสั่งอาหารที่ร้านเอง — ตรวจ Code ตอนชำระเงิน</div>
        <table class="atshop-table">
          <colgroup><col style="width:5%" /><col style="width:calc(${Math.ceil(clsLen * 1.3)}ch + 16px)" /><col style="width:18%" /><col />${codeCol}</colgroup>
          <thead>
            <tr>
              <th class="th num">#</th>
              <th class="th">คลาส</th>
              <th class="th">ชื่อเล่น</th>
              <th class="th">ชื่อ-นามสกุล</th>
              ${codeTh}
            </tr>
          </thead>
          <tbody>
            ${atShopRows
              .map(
                ({ r, cls }, i) => `
                <tr>
                  <td class="td num">${i + 1}</td>
                  ${clsTd(cls)}
                  <td class="td">${esc(r.nickname || "-")}</td>
                  <td class="td">${esc(r.studentName || "-")}${noCheckin(r)}</td>
                  ${codeTd(r)}
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>
       </div>
      </section>`
    : "";

  const placed = [...ordered, ...atShop];
  const paperCount = placed.filter((r) => !isECouponRow(r)).length;
  const footerHtml = `
      <div class="footer">
        รวมทั้งร้าน ${countsText(ordered.length, atShop.length)}${
          shop.source === "stock" ? ` (คูปองกระดาษ ${paperCount} · e-coupon ${placed.length - paperCount})` : ""
        }
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
      ${classBlocksHtml}
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
