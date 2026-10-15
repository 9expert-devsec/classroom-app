// src/app/lunch/[token]/_components/OptionLines.jsx
//
// ตัวเลือกของรายการ แบบมีชื่อกลุ่มนำหน้า: บรรทัดละกลุ่ม "<กลุ่ม>: <ค่า>, <ค่า>"
// แล้วตามด้วย "หมายเหตุ: …" บรรทัดของตัวเอง — ใช้ทั้งตะกร้า หน้าขอบคุณ และหน้าสแกนซ้ำ

/** ตัวเลือกจาก snapshot ของออเดอร์ (options[].groupName / choiceName) -> [{ name, values }] ตามลำดับเดิม */
export function groupsFromOrderLine(line) {
  const out = [];
  const byName = new Map();
  for (const o of line?.options || []) {
    const name = String(o?.groupName || "");
    let g = byName.get(name);
    if (!g) {
      g = { name, values: [] };
      byName.set(name, g);
      out.push(g);
    }
    if (o?.choiceName) g.values.push(o.choiceName);
  }
  return out.filter((g) => g.values.length > 0);
}

/** ตัวเลือกของบรรทัดในตะกร้า เทียบกับเมนู DTO ปัจจุบัน -> [{ name, values }] ตามลำดับกลุ่ม/ตัวเลือกในเมนู */
export function groupsFromCartLine(line, menu) {
  if (!menu) return [];
  const picked = new Map(
    (line?.choices || []).map((g) => [String(g.groupId), new Set((g.choiceIds || []).map(String))]),
  );
  const out = [];
  for (const group of menu.optionGroups || []) {
    const ids = picked.get(String(group.id));
    if (!ids) continue;
    const values = (group.choices || []).filter((c) => ids.has(String(c.id))).map((c) => c.name);
    if (values.length) out.push({ name: group.name || "", values });
  }
  return out;
}

export default function OptionLines({ groups = [], note = "", className = "" }) {
  if (!groups.length && !note) return null;
  return (
    <div className={`text-[13px] leading-snug ${className}`}>
      {groups.map((g, i) => (
        <p key={`${g.name}-${i}`}>
          {g.name ? <span className="text-[#5e6a7e]">{g.name}: </span> : null}
          <span className="font-medium text-[#0d1b2a]">{g.values.join(", ")}</span>
        </p>
      ))}
      {note ? (
        <p className="break-words text-[#5e6a7e]">หมายเหตุ: {note}</p>
      ) : null}
    </div>
  );
}
