// per-class Food Report print (summary page + one page per class)
// moved verbatim from FoodReportClient — the printed HTML is unchanged; only the date label is a parameter
import {
  rowType,
  TYPE_LABEL,
  couponLabelFor,
  couponStateText,
  sourceBadge,
  shopText,
  progressText,
  addonsOf,
  couponLinesText,
  flagLabels,
  cleanClassTitle,
  rowNote,
  staleNoticeHtml,
} from "./reportUi";

/* ---------- Summary builder (สำหรับหน้าแรกของ Print) ---------- */
/** ✅ สรุป “ชื่ออาหาร” (รวม COUPON ต่อร้าน + ไม่รับอาหาร ด้วย) */
function buildSummaryItems(rows) {
  const items = new Map();

  const add = (label, n = 1) => {
    const key = String(label || "").trim();
    if (!key) return;
    items.set(key, (items.get(key) || 0) + n);
  };

  rows.forEach((o) => {
    const t = rowType(o);
    if (t === "coupon") add(couponLabelFor(o), 1);
    else if (t === "none") add("ไม่รับอาหาร", 1);
    else add(String(o.menuName || "-").trim() || "-", 1);
  });

  return Array.from(items.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function buildAddonSummaryItems(rows) {
  const items = new Map();

  const add = (label, n = 1) => {
    const key = String(label || "").trim();
    if (!key) return;
    items.set(key, (items.get(key) || 0) + n);
  };

  rows.forEach((o) => {
    if (rowType(o) !== "set") return;

    // addons อาจอยู่ทั้ง o.addons และ o.food.addons
    const rawAddons = o.addons ?? o.food?.addons;

    const addons = Array.isArray(rawAddons)
      ? rawAddons
      : typeof rawAddons === "string"
        ? rawAddons
            .split("/")
            .map((x) => x.trim())
            .filter(Boolean)
        : [];

    addons.forEach((a) => add(a, 1));
  });

  return Array.from(items.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function buildDrinkSummaryItems(rows) {
  const items = new Map();

  const add = (label, n = 1) => {
    const key = String(label || "").trim();
    if (!key) return;
    items.set(key, (items.get(key) || 0) + n);
  };

  rows.forEach((o) => {
    if (rowType(o) !== "set") return;

    const drink = String(o.drink ?? o.food?.drink ?? "").trim();
    if (drink && drink !== "-") add(drink, 1);
  });

  return Array.from(items.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

// R4L-5: notice = บรรทัดแจ้งเตือนบนสุด (ข้อมูลวันที่ผ่านมา) — ว่าง = ไม่มี
export function buildClassPrintHtml(rows, printDate, { notice = "" } = {}) {
    // group by class for print
    const map = new Map();
    rows.forEach((o) => {
      const key = o.classId || o.className || "unknown";
      if (!map.has(key)) {
        const raw = o.className || o.classTitle || "-";
        map.set(key, {
          key,
          className: cleanClassTitle(raw, o.courseCode),
          courseCode: o.courseCode || "",
          roomName: o.roomName || "",
          items: [],
        });
      }
      map.get(key).items.push(o);
    });

    const printGroups = Array.from(map.values()).sort((a, b) =>
      a.className.localeCompare(b.className, "th"),
    );

    const generatedAt = new Date().toLocaleString("th-TH", {
      dateStyle: "short",
      timeStyle: "short",
    });

    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // ---------- PAGE 1: SUMMARY ----------
    const summaryItems = buildSummaryItems(rows);
    const addonSummaryItems = buildAddonSummaryItems(rows);
    const drinkSummaryItems = buildDrinkSummaryItems(rows);

    const addonRowsHtml = addonSummaryItems
      .map(
        (x, idx) => `
    <tr>
      <td style="border:1px solid #999;padding:6px;text-align:center;width:60px;">${idx + 1}</td>
      <td style="border:1px solid #999;padding:6px;">${x.label}</td>
      <td style="border:1px solid #999;padding:6px;text-align:center;width:120px;">${x.count}</td>
    </tr>
  `,
      )
      .join("");

    const drinkRowsHtml = drinkSummaryItems
      .map(
        (x, idx) => `
    <tr>
      <td style="border:1px solid #999;padding:6px;text-align:center;width:60px;">${idx + 1}</td>
      <td style="border:1px solid #999;padding:6px;">${x.label}</td>
      <td style="border:1px solid #999;padding:6px;text-align:center;width:120px;">${x.count}</td>
    </tr>
  `,
      )
      .join("");

    const classNames = Array.from(
      new Set(
        rows
          .map((r) =>
            cleanClassTitle(r.className || r.classTitle || "", r.courseCode),
          )
          .map((x) => String(x || "").trim())
          .filter(Boolean),
      ),
    );

    const classListHtml =
      classNames.length === 0
        ? `<span style="font-weight:700;">ทุกคลาส</span>`
        : classNames
            .map(
              (n) =>
                `<div style="margin-top:2px;font-weight:700;">• ${esc(n)}</div>`,
            )
            .join("");

    const summaryRowsHtml = summaryItems
      .map(
        (x, idx) => `
        <tr>
          <td style="border:1px solid #999;padding:6px;text-align:center;width:60px;">${idx + 1}</td>
          <td style="border:1px solid #999;padding:6px;">${esc(x.label)}</td>
          <td style="border:1px solid #999;padding:6px;text-align:center;width:120px;">${x.count}</td>
        </tr>
      `,
      )
      .join("");

    const summaryPageHtml = `
      <div class="page">
        <div style="text-align:center;margin-top:6px;">
          <div style="font-size:22px;font-weight:800;letter-spacing:.2px;">ใบสั่งอาหาร (Summary)</div>
          <div style="margin-top:6px;font-size:14px;">
            หลักสูตร/คลาส :
            <div style="margin-top:4px;line-height:1.25;">
              ${classListHtml}
            </div>
          </div>
          <div style="margin-top:6px;font-size:14px;">
            วันที่ : <span style="font-weight:700;">${printDate}</span>
          </div>
        </div>

        <div style="margin-top:18px;border:1px solid #999;border-radius:10px;overflow:hidden;">
          <table style="border-collapse:collapse;width:100%;font-size:14px;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="border:1px solid #999;padding:8px;">No.</th>
                <th style="border:1px solid #999;padding:8px;text-align:left;">ชื่ออาหาร</th>
                <th style="border:1px solid #999;padding:8px;">จำนวน</th>
              </tr>
            </thead>
            <tbody>
              ${
                summaryRowsHtml ||
                `<tr><td colspan="3" style="border:1px solid #999;padding:10px;text-align:center;color:#666;">ไม่มีข้อมูล</td></tr>`
              }
            </tbody>
          </table>
        </div>

        <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div style="border:1px solid #999;border-radius:8px;overflow:hidden;">
            <div style="background:#f3f4f6;padding:8px;font-weight:800;text-align:center;">Add-on</div>
            <table style="border-collapse:collapse;width:100%;font-size:13px;">
              <thead>
                <tr style="background:#fafafa;">
                  <th style="border:1px solid #999;padding:8px;">No.</th>
                  <th style="border:1px solid #999;padding:8px;text-align:left;">ชื่อ Add-on</th>
                  <th style="border:1px solid #999;padding:8px;">จำนวน</th>
                </tr>
              </thead>
              <tbody>
                ${
                  addonRowsHtml ||
                  `<tr><td colspan="3" style="border:1px solid #999;padding:10px;text-align:center;color:#666;">ไม่มีข้อมูล</td></tr>`
                }
              </tbody>
            </table>
          </div>

          <div style="border:1px solid #999;border-radius:8px;overflow:hidden;">
            <div style="background:#f3f4f6;padding:8px;font-weight:800;text-align:center;">เครื่องดื่ม</div>
            <table style="border-collapse:collapse;width:100%;font-size:13px;">
              <thead>
                <tr style="background:#fafafa;">
                  <th style="border:1px solid #999;padding:8px;">No.</th>
                  <th style="border:1px solid #999;padding:8px;text-align:left;">ชื่อเครื่องดื่ม</th>
                  <th style="border:1px solid #999;padding:8px;">จำนวน</th>
                </tr>
              </thead>
              <tbody>
                ${
                  drinkRowsHtml ||
                  `<tr><td colspan="3" style="border:1px solid #999;padding:10px;text-align:center;color:#666;">ไม่มีข้อมูล</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>

        <div style="margin-top:10px;font-size:11px;color:#6b7280;text-align:right;">
          สร้างเมื่อ ${generatedAt}
        </div>
      </div>

      <div class="page-break"></div>
    `;

    // ---------- CLASS PAGES ----------
    const classPagesHtml = printGroups
      .map((g, gi) => {
        const rowsHtml = g.items
          .map((o, idx) => {
            // C5c: ประเภท + สถานะคูปอง / ร้าน / Stock-E + Code / Progress — ไม่มีราคา
            const t = rowType(o);
            const isCoupon = t === "coupon";
            const isSet = t === "set";

            const typeCell = isCoupon
              ? `${TYPE_LABEL[t]}<div class="sub">${esc(couponStateText(o))}</div>`
              : esc(TYPE_LABEL[t]);

            const codeCell = isCoupon && o.code
              ? `${esc(sourceBadge(o))} · ${esc(o.code)}`
              : isCoupon
                ? esc(sourceBadge(o))
                : "";

            const progress = progressText(o) === "-" ? "" : progressText(o);

            const menu = isCoupon
              ? couponLinesText(o)
              : isSet
                ? (o.menuName ?? o.food?.menuName ?? "")
                : "ไม่รับอาหาร";

            const addons = isSet ? addonsOf(o).join(" / ") : "";
            const drink = isSet ? (o.drink ?? o.food?.drink ?? "") : "";

            const flags = flagLabels(o);
            const note = [rowNote(o), flags ? `⚠ ${flags}` : ""]
              .filter(Boolean)
              .join(" · ");

            // ✅ ตัดคอลัมน์ "บริษัท" ออกจาก Print
            return `
              <tr>
                <td class="td num">${idx + 1}</td>
                <td class="td">${esc(o.studentName || "-")}</td>
                <td class="td">${typeCell}</td>
                <td class="td">${esc(shopText(o) === "-" ? "" : shopText(o))}</td>
                <td class="td">${codeCell}</td>
                <td class="td">${esc(progress)}</td>
                <td class="td">${esc(menu)}</td>
                <td class="td">${esc(addons)}</td>
                <td class="td">${esc(drink)}</td>
                <td class="td">${esc(note)}</td>
              </tr>
            `;
          })
          .join("");

        return `
          <div class="page class-page">
            <table class="class-table">
              <colgroup>
                <col class="c-num" />
                <col class="c-student" />
                <col class="c-type" />
                <col class="c-shop" />
                <col class="c-code" />
                <col class="c-progress" />
                <col class="c-menu" />
                <col class="c-addon" />
                <col class="c-drink" />
                <col class="c-note" />
                </colgroup>
              <thead>
                <tr>
                  <th colspan="10" class="class-head">
                    <div class="class-title">${g.className}</div>
                    <div class="class-sub">
                      ${g.roomName ? `ห้อง ${g.roomName} • ` : ""}ผู้เรียน ${g.items.length} คน • ${printDate}
                    </div>
                  </th>
                </tr>
                <tr>
                  <th class="th num">#</th>
                  <th class="th">ชื่อผู้เรียน</th>
                  <th class="th">ประเภท</th>
                  <th class="th">ร้าน</th>
                  <th class="th">Code</th>
                  <th class="th">Progress</th>
                  <th class="th">เมนู / รายการ</th>
                  <th class="th">Add-on</th>
                  <th class="th">เครื่องดื่ม</th>
                  <th class="th">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rowsHtml ||
                  `<tr><td colspan="10" class="td empty">ไม่มีข้อมูล</td></tr>`
                }
              </tbody>
            </table>

            <div class="footer">สร้างเมื่อ ${generatedAt}</div>
          </div>

          ${gi === printGroups.length - 1 ? "" : `<div class="page-break"></div>`}
        `;
      })
      .join("");

    const html = `
      <!DOCTYPE html>
      <html lang="th">
        <head>
          <meta charset="utf-8" />
          <title>Food Report</title>
          <style>
            @page { size: A4 portrait;  margin: 10mm 9mm 10mm 17mm;  }
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              font-size: 12px;
              color: #111827;
              margin: 0;
            }
            .page { padding: 0; margin: 0; }
            .page-break { page-break-after: always; break-after: page; height: 0; }

            .class-table { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: fixed; }
            .class-table thead { display: table-header-group; }
            .class-table tfoot { display: table-footer-group; }
            tr { page-break-inside: avoid; break-inside: avoid; }

            .class-head { border: 1px solid #111827; padding: 10px; text-align: left; }
            .class-title { font-size: 16px; font-weight: 800; margin-bottom: 4px; }
            .class-sub { font-size: 11px; color: #6b7280; }

            .th, .td { border: 1px solid #111827; padding: 4px 5px; font-size: 11px; vertical-align: top; overflow: hidden; word-break: break-word;}
            .th { background: #f3f4f6; font-weight: 700; }
            .num { width: 54px; text-align: right; }
            .empty { text-align: center; color: #6b7280; padding: 10px; }

            .footer { margin-top: 8px; font-size: 11px; color: #6b7280; text-align: right; }

            .c-num      { width: 4%; }
            .c-student  { width: 17%; }
            .c-type     { width: 9%; }
            .c-shop     { width: 10%; }
            .c-code     { width: 11%; }
            .c-progress { width: 9%; }
            .c-menu     { width: 16%; }
            .c-addon    { width: 8%; }
            .c-drink    { width: 7%; }
            .c-note     { width: 9%; }
            .sub { font-size: 10px; color: #6b7280; }

            .trunc{white-space: nowrap; overflow: hidden; text-overflow: ellipsis;}


            @media print {
              body { margin: 0; }
              .page-break { page-break-after: always; break-after: page; }
            }
          </style>
        </head>
        <body>
          ${staleNoticeHtml(notice)}
          ${summaryPageHtml}
          ${classPagesHtml}
        </body>
      </html>
    `;

    return html;
}
