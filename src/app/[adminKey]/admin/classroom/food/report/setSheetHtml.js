// src/app/[adminKey]/admin/classroom/food/report/setSheetHtml.js
// ใบสั่งร้าน (ร้าน Set) — อาหารที่ผู้เรียนเลือกตอนเช็คอิน, 1 ร้าน / 1 วันต่อใบ
//   - หน้าตาเดียวกับใบสั่งร้านคูปอง (CSS + header เดียวกัน) ไม่มีราคา
//   - แถว = Food Report rows type "set" ของร้านนั้นในวันนั้น (ไม่รับอาหาร / คูปอง ไม่อยู่ใน sheet)
//   - สรุปครัว: นับต่อเมนู / add-on / เครื่องดื่ม ด้วยกติกาเดียวกับหน้า Summary ของ per-class print
import { CSS, esc, headerHtml } from "./orderSheetHtml";

function addonList(r) {
  // addons อาจอยู่ทั้ง r.addons และ r.food.addons (array หรือ string คั่นด้วย "/")
  const raw = r.addons ?? r.food?.addons;
  return Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw
          .split("/")
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
}

function drinkOf(r) {
  const d = String(r.drink ?? r.food?.drink ?? "").trim();
  return d && d !== "-" ? d : "";
}

function menuOf(r) {
  return String(r.menuName || r.food?.menuName || "-").trim() || "-";
}

function countBy(rows, labelsOf) {
  const m = new Map();
  rows.forEach((r) =>
    labelsOf(r).forEach((label) => {
      const k = String(label || "").trim();
      if (k) m.set(k, (m.get(k) || 0) + 1);
    }),
  );
  return [...m.entries()]
    .map(([label, qty]) => ({ label, qty }))
    .sort((a, b) => b.qty - a.qty || a.label.localeCompare(b.label, "th"));
}

function countTable(title, items, emptyText) {
  if (!items.length) return `<h3>${esc(title)}</h3><div class="sub">${esc(emptyText)}</div>`;
  return `
    <h3>${esc(title)}</h3>
    <table class="kitchen">
      <thead><tr><th class="th">${esc(title)}</th><th class="th" style="width:70px;text-align:center;">จำนวน</th></tr></thead>
      <tbody>
        ${items
          .map((k) => `<tr><td class="td">${esc(k.label)}</td><td class="td qty">×${k.qty}</td></tr>`)
          .join("")}
      </tbody>
    </table>`;
}

/**
 * @param {{ rows: object[], shopName: string, dateYMD: string, printedAt?: Date, origin?: string,
 *           classTitle: (row) => string }} args
 *   rows — Food Report rows of that set shop on dateYMD (type "set" only)
 * @returns {string} html
 */
export function buildSetSheetHtml({ rows, shopName, dateYMD, printedAt = new Date(), origin = "", classTitle }) {
  const list = (rows || []).filter((r) => r?.type === "set");
  const shop = { name: shopName };

  const menus = countBy(list, (r) => [menuOf(r)]);
  const addons = countBy(list, addonList);
  const drinks = countBy(list, (r) => [drinkOf(r)]);

  const listHtml = list.length
    ? `
      <table>
        <colgroup>
          <col style="width:5%" /><col style="width:18%" /><col style="width:19%" /><col style="width:19%" />
          <col style="width:14%" /><col style="width:11%" /><col style="width:14%" />
        </colgroup>
        <thead>
          <tr>
            <th class="th num">#</th>
            <th class="th">ชื่อ-นามสกุล</th>
            <th class="th">Class / ห้อง</th>
            <th class="th">เมนู</th>
            <th class="th">Add-on</th>
            <th class="th">เครื่องดื่ม</th>
            <th class="th">หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
          ${list
            .map(
              (r, i) => `
                <tr>
                  <td class="td num">${i + 1}</td>
                  <td class="td">${esc(r.studentName || "-")}</td>
                  <td class="td">${esc(classTitle(r))}${
                    r.roomName ? `<div class="sub">ห้อง ${esc(r.roomName)}</div>` : ""
                  }</td>
                  <td class="td">${esc(menuOf(r))}</td>
                  <td class="td lines">${
                    addonList(r)
                      .map((a) => `<div>${esc(a)}</div>`)
                      .join("") || "-"
                  }</td>
                  <td class="td">${esc(drinkOf(r) || "-")}</td>
                  <td class="td">${esc(String(r.note ?? r.food?.note ?? "").trim() || "-")}</td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>`
    : `<div class="sub">ไม่มี</div>`;

  const body = `
    <div class="page">
      ${headerHtml({ shop, dateYMD, printedAt, afterHHMM: "", origin })}

      ${countTable("เมนู", menus, "ไม่มีรายการ")}
      ${countTable("Add-on", addons, "ไม่มี Add-on")}
      ${countTable("เครื่องดื่ม", drinks, "ไม่มีเครื่องดื่ม")}

      <h3>รายชื่อผู้เรียน (${list.length})</h3>
      ${listHtml}

      <div class="footer">รวม ${list.length} ที่</div>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <title>ใบสั่งร้าน ${esc(shopName)} ${esc(dateYMD)}</title>
    <style>${CSS}</style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}
