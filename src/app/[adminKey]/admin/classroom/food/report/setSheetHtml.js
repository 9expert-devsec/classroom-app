// src/app/[adminKey]/admin/classroom/food/report/setSheetHtml.js
// ใบสั่งร้าน (ร้าน Set) — อาหารที่ผู้เรียนเลือกตอนเช็คอิน, 1 ร้าน / 1 วันต่อใบ
//   - หน้าตาเดียวกับใบสั่งร้านคูปอง (CSS + header เดียวกัน) ไม่มีราคา
//   - แถว = Food Report rows type "set" ของร้านนั้นในวันนั้น (ไม่รับอาหาร / คูปอง ไม่อยู่ใน sheet)
//   - สรุปครัว: ตารางเลข 1–3 นับต่อเมนู / add-on / เครื่องดื่ม ด้วยกติกาเดียวกับหน้า Summary ของ per-class print
//   - R5-5f: หน้ารายชื่อแบ่งบล็อกต่อคลาส (groupRowsByClass + classHeadHtml + CSS ของใบสั่งร้านคูปอง)
//            ไม่มีคอลัมน์ Class / ห้อง · เลขลำดับเริ่มใหม่ทุกคลาส · ท้ายใบ "รวมทั้งร้าน n ที่"
import {
  CSS,
  classHeadHtml,
  compactHeaderHtml,
  esc,
  groupRowsByClass,
  headerHtml,
  summaryTableHtml,
} from "./orderSheetHtml";
import { printableRows, rowNote } from "./_components/reportUi";

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

// count rows per label (1 per row per label, blanks skipped), most first
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

/**
 * @param {{ rows: object[], shopName: string, dateYMD: string, printedAt?: Date, origin?: string }} args
 *   rows — Food Report rows of that set shop on dateYMD (type "set" only)
 *   (R5-5f: ชื่อคลาสมาจาก groupRowsByClass — classTitle ที่ผู้เรียกยังส่งมาไม่ได้ใช้แล้ว)
 * @returns {string} html
 */
export function buildSetSheetHtml({ rows, shopName, dateYMD, printedAt = new Date(), origin = "" }) {
  // R4-6: ตัวกรองเดียวกับทุกทางพิมพ์/Export (ยังไม่เลือก / ไม่มีข้อมูล ไม่ออกในเอกสาร)
  const list = printableRows(rows).filter((r) => r?.type === "set");
  const shop = { name: shopName };

  const menus = countBy(list, (r) => [menuOf(r)]);
  const addons = countBy(list, addonList);
  const drinks = countBy(list, (r) => [drinkOf(r)]);

  // 1. เมนู (always) · then Add-on / เครื่องดื่ม only when there are any, numbered consecutively
  const sections = [
    { title: "สรุปเมนูที่ต้องเตรียม (รวมทั้งหมด)", itemHeader: "เมนูอาหาร", items: menus, icon: true, emptyText: "ไม่มีรายการ" },
    ...(addons.length ? [{ title: "Add-on", itemHeader: "รายการ", items: addons }] : []),
    ...(drinks.length ? [{ title: "เครื่องดื่ม", itemHeader: "รายการ", items: drinks }] : []),
  ];
  // set sheets: no หมายเหตุ column (# · name · จำนวนรวม)
  const summaryHtml = sections.map((s, i) => summaryTableHtml({ num: i + 1, showNote: false, ...s })).join("");

  // R5-5f: 1 บล็อกต่อคลาส (ลำดับ / หัวคลาส / กติกาพิมพ์เดียวกับใบสั่งร้านคูปอง)
  //   หัวคลาส, "รายชื่อผู้เรียน (n)", ตาราง — เลขเริ่ม 1 ทุกคลาส, ไม่มียอดย่อย
  const listTableHtml = (rs) => `
        <table>
          <colgroup>
            <col style="width:5%" /><col style="width:22%" /><col style="width:25%" />
            <col style="width:20%" /><col style="width:13%" /><col style="width:15%" />
          </colgroup>
          <thead>
            <tr>
              <th class="th num">#</th>
              <th class="th">ชื่อ-นามสกุล</th>
              <th class="th">เมนู</th>
              <th class="th">Add-on</th>
              <th class="th">เครื่องดื่ม</th>
              <th class="th">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            ${rs
              .map(
                (r, i) => `
                <tr>
                  <td class="td num">${i + 1}</td>
                  <td class="td">${esc(r.studentName || "-")}</td>
                  <td class="td">${esc(menuOf(r))}</td>
                  <td class="td lines">${
                    addonList(r)
                      .map((a) => `<div>${esc(a)}</div>`)
                      .join("") || "-"
                  }</td>
                  <td class="td">${esc(drinkOf(r) || "-")}</td>
                  <td class="td">${esc(rowNote(r) || "-")}</td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>`;

  const listHtml = groupRowsByClass(list)
    .map(
      (g) => `
      <section class="class-block">${classHeadHtml(g)}
        <h3>รายชื่อผู้เรียน (${g.rows.length})</h3>${listTableHtml(g.rows)}
      </section>`,
    )
    .join("");

  const footerHtml = `<div class="footer">รวมทั้งร้าน ${list.length} ที่</div>`;
  const hasList = list.length > 0;

  // page 1: header + kitchen summary · page 2+: compact header, class blocks, footer
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
