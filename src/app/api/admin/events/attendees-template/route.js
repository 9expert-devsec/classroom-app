import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const headersTH = [
    "ชื่อ-นามสกุล",
    "เบอร์โทร",
    "อีเมล",
    "ช่องที่ทราบข่าวกิจกรรม",
    "เพศ",
    "อายุ",
    "สถานภาพการทำงาน",
  ];

  const sample = [
    "ทดสอบ ใส่ชื่อ",
    "0999999999",
    "test@example.com",
    "Facebook",
    "ชาย",
    "29",
    "พนักงานบริษัท",
  ];

  const bom = "\uFEFF"; // UTF-8 BOM กันภาษาไทยเพี้ยนใน Excel
  const csv = bom + toCsv([headersTH, sample]);

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition":
        'attachment; filename="event-attendees-template.csv"',
      "cache-control": "no-store",
    },
  });
}

function toCsv(rows) {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = String(v ?? "");
          // escape quote
          const escaped = s.replace(/"/g, '""');
          // wrap if contains special chars
          if (/[",\n\r]/.test(escaped)) return `"${escaped}"`;
          return escaped;
        })
        .join(","),
    )
    .join("\n");
}
