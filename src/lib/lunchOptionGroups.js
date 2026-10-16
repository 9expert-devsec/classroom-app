// src/lib/lunchOptionGroups.js
//
// ตัวเลือกของบรรทัดที่สั่ง -> [{ group, values }] สำหรับแสดง 1 บรรทัดต่อกลุ่ม "<กลุ่ม>: <ค่า>, <ค่า>"
// ใช้ร่วมกันทั้งใบสั่งร้าน (orderSheetHtml) และหน้าจอร้าน (MerchantShopClient) — pure, ไม่มี React
//   - optionDetails [{ groupName, choiceName }] (r2b) ถ้ามี ไม่งั้น options (string ค่าอย่างเดียว)
//   - บรรทัดเก่าที่ไม่มีชื่อกลุ่ม -> { group: "", values: [ค่า] } แสดงค่าเฉยๆ (ไม่มี "undefined:" / ป้ายว่าง)

export function optionGroupsOf(line) {
  const out = [];
  const byGroup = new Map();
  const src =
    Array.isArray(line?.optionDetails) && line.optionDetails.length
      ? line.optionDetails
      : Array.isArray(line?.options)
        ? line.options
        : [];

  for (const o of src) {
    if (!o) continue;
    if (typeof o === "string") {
      out.push({ group: "", values: [o] });
      continue;
    }
    const value = String(o.choiceName || "").trim();
    if (!value) continue;
    const group = String(o.groupName || "").trim();
    let g = group ? byGroup.get(group) : null;
    if (!g) {
      g = { group, values: [] };
      if (group) byGroup.set(group, g);
      out.push(g);
    }
    g.values.push(value);
  }
  return out;
}
