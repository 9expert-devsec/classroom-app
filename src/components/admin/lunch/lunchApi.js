// fetch helpers ของหน้าแอดมินอาหารกลางวัน (ติดตามการสั่งอาหาร / Counter)
// error ของ /api/admin/lunch/* เป็น { error: ข้อความไทย, reason }

export async function safeJson(res) {
  const t = await res.text().catch(() => "");
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return {};
  }
}

/** POST JSON -> body ของผลลัพธ์, หรือ throw Error(ข้อความไทย) พร้อม .reason */
export async function postLunchAdmin(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await safeJson(res);
  if (!res.ok) {
    const err = new Error(json.error || "ทำรายการไม่สำเร็จ");
    err.reason = json.reason || "";
    throw err;
  }
  return json;
}
