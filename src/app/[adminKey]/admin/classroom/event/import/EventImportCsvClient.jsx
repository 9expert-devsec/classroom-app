"use client";

import { useEffect, useMemo, useState } from "react";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function clean(s) {
  return String(s || "").trim();
}

async function readFileText(file) {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsText(file, "utf-8");
  });
}

// CSV parser (รองรับ quote)
function parseCsv(text) {
  const s = String(text || "").replace(/^\uFEFF/, ""); // strip BOM
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }

    if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }

    if (ch === "\r") {
      // ignore \r
      continue;
    }

    cur += ch;
  }

  row.push(cur);
  rows.push(row);

  // trim empty tail rows
  return rows
    .map((r) => r.map((c) => String(c ?? "")))
    .filter((r) => r.some((c) => clean(c) !== ""));
}

function normHeader(h) {
  return clean(h)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/]/g, "");
}

// map thai/english headers to keys
const HEADER_MAP = {
  // TH
  ชื่อนามสกุล: "fullName",
  เบอร์โทร: "phone",
  โทร: "phone",
  อีเมล: "email",
  ช่องที่ทราบข่าวกิจกรรม: "sourceChannel",
  ช่องที่ทราบข่าว: "sourceChannel",
  เพศ: "gender",
  อายุ: "age",
  สถานภาพการทำงาน: "workStatus",

  // EN
  fullname: "fullName",
  name: "fullName",
  phone: "phone",
  tel: "phone",
  email: "email",
  sourcechannel: "sourceChannel",
  channel: "sourceChannel",
  gender: "gender",
  age: "age",
  workstatus: "workStatus",
  employmentstatus: "workStatus",
};

function toObjects(rows) {
  if (!rows.length) return { items: [], error: "empty csv" };
  const header = rows[0] || [];
  const colKeys = header.map((h) => HEADER_MAP[normHeader(h)] || "");

  // ต้องมี fullName อย่างน้อย
  if (!colKeys.includes("fullName")) {
    return {
      items: [],
      error: "ไม่พบคอลัมน์ 'ชื่อ-นามสกุล' (fullName) ในไฟล์",
    };
  }

  const items = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const obj = {};
    for (let c = 0; c < colKeys.length; c++) {
      const k = colKeys[c];
      if (!k) continue;
      obj[k] = r[c] ?? "";
    }

    // skip empty rows
    if (!clean(obj.fullName) && !clean(obj.phone) && !clean(obj.email))
      continue;
    items.push(obj);
  }

  return { items, error: "" };
}

function downloadFromUrl(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function EventImportCsvClient() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");

  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);

  const [validated, setValidated] = useState(null); // {summary, items}
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const canValidate = !!eventId && parsedRows.length > 0;

  const previewRows = useMemo(() => {
    const items = validated?.items || [];
    return items.slice(0, 50);
  }, [validated]);

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

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPickFile(file) {
    setErr("");
    setValidated(null);
    setRawRows([]);
    setParsedRows([]);

    if (!file) return;
    setFileName(file.name || "");

    setLoading(true);
    try {
      const text = await readFileText(file);
      const rows = parseCsv(text);
      setRawRows(rows);

      const { items, error } = toObjects(rows);
      if (error) throw new Error(error);

      setParsedRows(items);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function validate() {
    setErr("");
    setValidated(null);
    if (!canValidate) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/attendees/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "validate", rows: parsedRows }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok)
        throw new Error(data?.error || "validate failed");
      setValidated(data);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function doImport() {
    setErr("");
    if (!validated?.items?.length) {
      setErr("กรุณา Validate ก่อน");
      return;
    }
    if (
      !confirm(
        "นำเข้าข้อมูลผู้เข้าร่วม? (จะนำเข้าเฉพาะแถวที่ผ่าน Validate และไม่ซ้ำ)",
      )
    )
      return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/attendees/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "import", rows: parsedRows }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "import failed");

      alert(
        `นำเข้าสำเร็จ: ${data.createdCount} รายการ | ข้าม: ${data.skippedCount} รายการ`,
      );
      // reset file state
      setFileName("");
      setRawRows([]);
      setParsedRows([]);
      setValidated(null);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  function downloadTemplate() {
    downloadFromUrl(
      "/api/admin/events/attendees-template",
      "event-attendees-template.csv",
    );
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold">
            Import CSV ผู้เข้าร่วม Event
          </div>
          <div className="mt-1 text-sm text-zinc-600">
            อัปโหลด CSV → Preview/Validate → Import (กันซ้ำในไฟล์และในฐานข้อมูล)
          </div>
        </div>

        <button
          className="h-10 rounded-xl border px-4 text-sm font-semibold hover:bg-zinc-50"
          onClick={downloadTemplate}
        >
          ดาวน์โหลด Template
        </button>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <div className="mb-1 font-medium text-zinc-700">เลือก Event</div>
            <select
              className="h-11 w-full rounded-xl border px-3 outline-none focus:ring-2"
              value={eventId}
              onChange={(e) => {
                setEventId(e.target.value);
                setValidated(null);
              }}
            >
              {events.map((ev) => (
                <option key={ev._id} value={ev._id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </label>

          <div className="text-sm">
            <div className="mb-1 font-medium text-zinc-700">อัปโหลด CSV</div>
            <label
              className={cx(
                "inline-flex h-11 w-full cursor-pointer items-center justify-between rounded-xl border px-3",
                loading ? "bg-zinc-50 text-zinc-500" : "bg-white",
              )}
            >
              <span className="truncate text-sm">
                {fileName || "เลือกไฟล์ .csv"}
              </span>
              <span className="text-xs font-semibold">Browse</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={loading}
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />
            </label>
            <div className="mt-1 text-xs text-zinc-500">
              รองรับหัวคอลัมน์ไทย/อังกฤษ (ชื่อ-นามสกุล ต้องมี)
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            className={cx(
              "h-11 rounded-xl px-4 font-semibold",
              !canValidate || loading
                ? "bg-zinc-200 text-zinc-500"
                : "bg-black text-white",
            )}
            disabled={!canValidate || loading}
            onClick={validate}
          >
            {loading ? "กำลังทำงาน..." : "Preview / Validate"}
          </button>

          <button
            className={cx(
              "h-11 rounded-xl px-4 font-semibold",
              !validated?.items?.length || loading
                ? "bg-zinc-200 text-zinc-500"
                : "bg-emerald-600 text-white",
            )}
            disabled={!validated?.items?.length || loading}
            onClick={doImport}
          >
            Import เข้าระบบ
          </button>
        </div>

        {/* Summary */}
        {validated?.summary && (
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-6">
            <Stat label="ทั้งหมด" value={validated.summary.total} />
            <Stat label="นำเข้าได้" value={validated.summary.insertable} />
            <Stat label="ข้าม" value={validated.summary.skipped} />
            <Stat label="ซ้ำในไฟล์" value={validated.summary.dupInFile} />
            <Stat label="ซ้ำใน DB" value={validated.summary.dupInDb} />
            <Stat label="ชื่อว่าง" value={validated.summary.missingName} />
          </div>
        )}

        {/* Preview table */}
        {validated?.items?.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="bg-zinc-50">
                <tr className="text-left">
                  <th className="px-4 py-3">แถว</th>
                  <th className="px-4 py-3">ชื่อ-นามสกุล</th>
                  <th className="px-4 py-3">เบอร์</th>
                  <th className="px-4 py-3">อีเมล</th>
                  <th className="px-4 py-3">ช่องทาง</th>
                  <th className="px-4 py-3">เพศ</th>
                  <th className="px-4 py-3">อายุ</th>
                  <th className="px-4 py-3">สถานภาพ</th>
                  <th className="px-4 py-3">ผลตรวจสอบ</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((x) => {
                  const d = x.doc || {};
                  const ok = x.action === "insert";
                  return (
                    <tr key={x.rowIndex} className="border-t">
                      <td className="px-4 py-3">{x.rowIndex}</td>
                      <td className="px-4 py-3 font-semibold">
                        {d.fullName || "-"}
                      </td>
                      <td className="px-4 py-3">{d.phone || "-"}</td>
                      <td className="px-4 py-3">{d.email || "-"}</td>
                      <td className="px-4 py-3">{d.sourceChannel || "-"}</td>
                      <td className="px-4 py-3">{d.gender || "-"}</td>
                      <td className="px-4 py-3">{d.age ?? "-"}</td>
                      <td className="px-4 py-3">{d.workStatus || "-"}</td>
                      <td className="px-4 py-3">
                        {ok ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                            นำเข้าได้
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {x.issues?.includes("missing_fullName") && (
                              <Badge tone="red">ชื่อว่าง</Badge>
                            )}
                            {x.issues?.includes("duplicate_in_file") && (
                              <Badge tone="amber">ซ้ำในไฟล์</Badge>
                            )}
                            {x.issues?.includes("duplicate_in_db") && (
                              <Badge tone="amber">ซ้ำใน DB</Badge>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {validated.items.length > 50 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-4 text-center text-xs text-zinc-500"
                    >
                      แสดงตัวอย่าง 50 แถวแรกจากทั้งหมด {validated.items.length}{" "}
                      แถว
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* helper */}
        {!!parsedRows.length && !validated && (
          <div className="mt-4 text-xs text-zinc-500">
            อ่านไฟล์แล้ว {parsedRows.length} แถว — กด “Preview / Validate”
            เพื่อตรวจสอบก่อน Import
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-extrabold">{value}</div>
    </div>
  );
}

function Badge({ children, tone = "zinc" }) {
  const cls =
    tone === "red"
      ? "bg-red-50 text-red-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : "bg-zinc-100 text-zinc-700";

  return (
    <span className={cx("rounded-full px-2 py-1 text-xs font-semibold", cls)}>
      {children}
    </span>
  );
}
