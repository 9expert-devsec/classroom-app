"use client";

import { useEffect, useMemo, useState } from "react";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function formatDTTH(x) {
  if (!x) return "-";
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

function toCsv(rows) {
  const bom = "\uFEFF";
  const csv = rows
    .map((r) =>
      r
        .map((v) => {
          const s = String(v ?? "");
          const escaped = s.replace(/"/g, '""');
          if (/[",\n\r]/.test(escaped)) return `"${escaped}"`;
          return escaped;
        })
        .join(","),
    )
    .join("\n");
  return bom + csv;
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename || "export.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export default function EventReportClient() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [report, setReport] = useState(null); // {event, totals, breakdowns, items}

  const canLoad = !!eventId;

  async function loadEvents() {
    setErr("");
    try {
      const res = await fetch("/api/admin/events", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok)
        throw new Error(data?.error || "load events failed");
      setEvents(data.items || []);
      if (!eventId && data.items?.[0]?._id)
        setEventId(String(data.items[0]._id));
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  async function loadReport() {
    if (!eventId) return;
    setErr("");
    setLoading(true);
    try {
      const url = new URL("/api/admin/events/report", window.location.origin);
      url.searchParams.set("eventId", eventId);

      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok)
        throw new Error(data?.error || "load report failed");

      setReport(data);
    } catch (e) {
      setErr(String(e?.message || e));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (eventId) loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const items = report?.items || [];
  const event = report?.event || null;

  const csvRows = useMemo(() => {
    const header = [
      "ชื่อ-นามสกุล",
      "เบอร์โทร",
      "อีเมล",
      "ช่องที่ทราบข่าว",
      "เพศ",
      "อายุ",
      "สถานภาพการทำงาน",
      "สถานะ",
      "เวลาเช็คอิน",
    ];
    const rows = items.map((x) => [
      x.fullName || "",
      x.phone || "",
      x.email || "",
      x.sourceChannel || "",
      x.gender || "",
      x.age ?? "",
      x.workStatus || "",
      x.checkedInAt ? "เช็คอินแล้ว" : "ยังไม่เช็คอิน",
      x.checkedInAt ? formatDTTH(x.checkedInAt) : "",
    ]);
    return [header, ...rows];
  }, [items]);

  function exportCsv() {
    const titleSafe = String(event?.title || "event").replace(
      /[^\w\u0E00-\u0E7F]+/g,
      "_",
    );
    downloadText(toCsv(csvRows), `event-report-${titleSafe}.csv`);
  }

  function printReport() {
    if (!report) return;

    const now = formatDTTH(new Date().toISOString());
    const t = report.totals || {};
    const b = report.breakdowns || {};
    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const breakdownTable = (title, rows) => {
      const safeRows = Array.isArray(rows) ? rows : [];
      const body = safeRows
        .map(
          (r) => `
          <tr>
            <td>${esc(r.label)}</td>
            <td style="text-align:right;">${esc(r.count)}</td>
          </tr>`,
        )
        .join("");
      return `
        <div class="card">
          <div class="cardTitle">${esc(title)}</div>
          <table class="tbl">
            <thead><tr><th>รายการ</th><th style="text-align:right;">จำนวน</th></tr></thead>
            <tbody>${body || `<tr><td colspan="2" class="muted">-</td></tr>`}</tbody>
          </table>
        </div>
      `;
    };

    const attendeesRows = items
      .map(
        (x, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${esc(x.fullName || "-")}</td>
          <td>${esc(x.phone || "-")}</td>
          <td>${esc(x.email || "-")}</td>
          <td>${x.checkedInAt ? `<span class="ok">เช็คอินแล้ว</span>` : `<span class="no">ยังไม่เช็คอิน</span>`}</td>
          <td>${x.checkedInAt ? esc(formatDTTH(x.checkedInAt)) : "-"}</td>
        </tr>`,
      )
      .join("");

    const html = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Event Report</title>
<style>
  body{ font-family: Arial, sans-serif; margin:24px; color:#111; }
  .muted{ color:#666; }
  .top{ display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
  .h1{ font-size:20px; font-weight:800; margin:0; }
  .meta{ margin-top:6px; font-size:12px; color:#444; }
  .grid{ display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-top:14px; }
  .stat{ border:1px solid #e5e7eb; border-radius:12px; padding:12px; background:#fafafa; }
  .stat .k{ font-size:11px; color:#666; }
  .stat .v{ font-size:22px; font-weight:800; margin-top:4px; }
  .break{ display:grid; grid-template-columns: repeat(2, 1fr); gap:12px; margin-top:12px; }
  .card{ border:1px solid #e5e7eb; border-radius:12px; padding:12px; }
  .cardTitle{ font-weight:800; margin-bottom:8px; }
  .tbl{ width:100%; border-collapse:collapse; font-size:12px; }
  .tbl th,.tbl td{ border-bottom:1px solid #eee; padding:8px; text-align:left; vertical-align:top; }
  .ok{ color:#047857; font-weight:700; }
  .no{ color:#111827; font-weight:700; }
  .pageBreak{ page-break-before: always; }
  @media print{
    body{ margin:10mm; }
  }
</style>
</head>
<body>
  <div class="top">
    <div>
      <div class="h1">รายงาน Event</div>
      <div class="meta">
        <div><b>ชื่อ:</b> ${esc(event?.title || "-")}</div>
        <div><b>สถานที่:</b> ${esc(event?.location || "-")}</div>
        <div><b>เวลา:</b> ${esc(formatDTTH(event?.startAt))}</div>
      </div>
    </div>
    <div class="muted" style="font-size:12px;">พิมพ์เมื่อ: ${esc(now)}</div>
  </div>

  <div class="grid">
    <div class="stat"><div class="k">ผู้ลงทะเบียนทั้งหมด</div><div class="v">${esc(t.total)}</div></div>
    <div class="stat"><div class="k">เช็คอินแล้ว</div><div class="v">${esc(t.checkedIn)}</div></div>
    <div class="stat"><div class="k">ยังไม่เช็คอิน</div><div class="v">${esc(t.notCheckedIn)}</div></div>
  </div>

  <div class="break">
    ${breakdownTable("ช่องที่ทราบข่าวกิจกรรม", b.sourceChannel)}
    ${breakdownTable("เพศ", b.gender)}
    ${breakdownTable("สถานภาพการทำงาน", b.workStatus)}
    ${breakdownTable("ช่วงอายุ", b.ageBucket)}
  </div>

  <div class="pageBreak"></div>

  <div class="card">
    <div class="cardTitle">รายชื่อผู้เข้าร่วม</div>
    <table class="tbl">
      <thead>
        <tr>
          <th style="width:44px;">#</th>
          <th>ชื่อ</th>
          <th style="width:140px;">เบอร์</th>
          <th style="width:220px;">อีเมล</th>
          <th style="width:110px;">สถานะ</th>
          <th style="width:170px;">เวลาเช็คอิน</th>
        </tr>
      </thead>
      <tbody>
        ${attendeesRows || `<tr><td colspan="6" class="muted">ไม่มีข้อมูล</td></tr>`}
      </tbody>
    </table>
  </div>

  <script>
    window.onload = () => { window.print(); };
  </script>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold">Event Report</div>
          <div className="mt-1 text-sm text-zinc-600">
            Dashboard / Export / Print
          </div>
        </div>

        <button
          className="h-10 rounded-xl border px-4 text-sm font-semibold hover:bg-zinc-50"
          onClick={loadReport}
          disabled={!canLoad || loading}
        >
          {loading ? "กำลังโหลด..." : "Refresh"}
        </button>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm sm:col-span-2">
            <div className="mb-1 font-medium text-zinc-700">เลือก Event</div>
            <select
              className="h-11 w-full rounded-xl border px-3 outline-none focus:ring-2"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            >
              {events.map((ev) => (
                <option key={ev._id} value={ev._id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              className={cx(
                "h-11 flex-1 rounded-xl px-4 text-sm font-semibold",
                !report ? "bg-zinc-200 text-zinc-500" : "bg-black text-white",
              )}
              disabled={!report}
              onClick={exportCsv}
            >
              Download CSV
            </button>
            <button
              className={cx(
                "h-11 flex-1 rounded-xl px-4 text-sm font-semibold",
                !report
                  ? "bg-zinc-200 text-zinc-500"
                  : "bg-emerald-600 text-white",
              )}
              disabled={!report}
              onClick={printReport}
            >
              Print
            </button>
          </div>
        </div>

        {!!event && (
          <div className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm">
            <div className="font-semibold">{event.title}</div>
            <div className="mt-1 text-zinc-700">
              สถานที่: {event.location || "-"}
            </div>
            <div className="text-zinc-700">
              เวลา: {formatDTTH(event.startAt)}
            </div>
          </div>
        )}

        {!!report?.totals && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Stat label="ผู้ลงทะเบียนทั้งหมด" value={report.totals.total} />
            <Stat label="เช็คอินแล้ว" value={report.totals.checkedIn} />
            <Stat label="ยังไม่เช็คอิน" value={report.totals.notCheckedIn} />
          </div>
        )}

        {!!report?.breakdowns && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <BreakCard
              title="ช่องที่ทราบข่าวกิจกรรม"
              items={report.breakdowns.sourceChannel}
            />
            <BreakCard title="เพศ" items={report.breakdowns.gender} />
            <BreakCard
              title="สถานภาพการทำงาน"
              items={report.breakdowns.workStatus}
            />
            <BreakCard title="ช่วงอายุ" items={report.breakdowns.ageBucket} />
          </div>
        )}

        {!!items.length && (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-zinc-50">
                <tr className="text-left">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">ชื่อ</th>
                  <th className="px-4 py-3">เบอร์</th>
                  <th className="px-4 py-3">อีเมล</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3">เวลาเช็คอิน</th>
                </tr>
              </thead>
              <tbody>
                {items.map((x, idx) => (
                  <tr key={x._id} className="border-t">
                    <td className="px-4 py-3">{idx + 1}</td>
                    <td className="px-4 py-3 font-semibold">
                      {x.fullName || "-"}
                    </td>
                    <td className="px-4 py-3">{x.phone || "-"}</td>
                    <td className="px-4 py-3">{x.email || "-"}</td>
                    <td className="px-4 py-3">
                      {x.checkedInAt ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                          เช็คอินแล้ว
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                          ยังไม่เช็คอิน
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {x.checkedInAt ? formatDTTH(x.checkedInAt) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && report && !items.length && (
          <div className="mt-4 text-sm text-zinc-500">
            ไม่มีรายชื่อผู้เข้าร่วม
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold">{value ?? 0}</div>
    </div>
  );
}

function BreakCard({ title, items }) {
  const rows = Array.isArray(items) ? items : [];
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-sm font-extrabold">{title}</div>
      <div className="mt-3 overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-3 py-2 text-left">รายการ</th>
              <th className="px-3 py-2 text-right">จำนวน</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r) => (
                <tr key={r.label} className="border-t">
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {r.count}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-4 text-center text-zinc-500" colSpan={2}>
                  -
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
