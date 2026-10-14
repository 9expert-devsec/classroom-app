// src/app/[adminKey]/admin/classroom/food/report/setSheetHtml.js
// ใบสั่งร้าน (ร้าน Set) — อาหารที่ผู้เรียนเลือกตอนเช็คอิน, 1 ร้าน / 1 วันต่อใบ
//   - หน้าตาเดียวกับใบสั่งร้านคูปอง (CSS + header เดียวกัน) ไม่มีราคา
//   - แถว = Food Report rows type "set" ของร้านนั้นในวันนั้น (ไม่รับอาหาร / คูปอง ไม่อยู่ใน sheet)
//   - สรุปครัว: ตารางเลข 1–3 นับต่อเมนู / add-on / เครื่องดื่ม ด้วยกติกาเดียวกับหน้า Summary ของ per-class print
import { CSS, compactHeaderHtml, countsNote, esc, headerHtml, summaryTableHtml } from "./orderSheetHtml";

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

const cleanLabels = (labels) => labels.map((x) => String(x || "").trim()).filter(Boolean);

/**
 * count rows per label (same rule as before: 1 per row per label, blanks skipped)
 * note = what came with it, counted — e.g. a menu's add-ons, or the menus an add-on / drink went with
 */
function countWithNote(rows, labelsOf, noteLabelsOf) {
  const m = new Map();
  rows.forEach((r) => {
    const notes = cleanLabels(noteLabelsOf(r));
    cleanLabels(labelsOf(r)).forEach((k) => {
      const x = m.get(k) || { qty: 0, notes: new Map() };
      x.qty += 1;
      notes.forEach((n) => x.notes.set(n, (x.notes.get(n) || 0) + 1));
      m.set(k, x);
    });
  });
  return [...m.entries()]
    .map(([label, x]) => ({ label, qty: x.qty, note: countsNote(x.notes) }))
    .sort((a, b) => b.qty - a.qty || a.label.localeCompare(b.label, "th"));
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

  const menus = countWithNote(list, (r) => [menuOf(r)], addonList);
  const addons = countWithNote(list, addonList, (r) => [menuOf(r)]);
  const drinks = countWithNote(list, (r) => [drinkOf(r)], (r) => [menuOf(r)]);

  // 1. เมนู (always) · then Add-on / เครื่องดื่ม only when there are any, numbered consecutively
  const sections = [
    { title: "สรุปเมนูที่ต้องเตรียม (รวมทั้งหมด)", itemHeader: "เมนูอาหาร", items: menus, icon: true, emptyText: "ไม่มีรายการ" },
    ...(addons.length ? [{ title: "Add-on", itemHeader: "รายการ", items: addons }] : []),
    ...(drinks.length ? [{ title: "เครื่องดื่ม", itemHeader: "รายการ", items: drinks }] : []),
  ];
  const summaryHtml = sections.map((s, i) => summaryTableHtml({ num: i + 1, ...s })).join("");

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

  const footerHtml = `<div class="footer">รวม ${list.length} ที่</div>`;
  const hasList = list.length > 0;

  // page 1: header + kitchen summary · page 2+: compact header, learner list, footer
  const body = `
    <div class="page summary-page${hasList ? " has-list" : ""}">
      ${headerHtml({ shop, dateYMD, printedAt, afterHHMM: "", origin })}

      ${summaryHtml}
      ${hasList ? "" : footerHtml}
    </div>
    ${
      hasList
        ? `
    <div class="page list-page">
      ${compactHeaderHtml({ shop, dateYMD })}

      <h3>รายชื่อผู้เรียน (${list.length})</h3>
      ${listHtml}
      ${footerHtml}
    </div>`
        : ""
    }
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
