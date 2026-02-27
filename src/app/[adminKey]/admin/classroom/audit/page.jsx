"use client";

import { useEffect, useMemo, useState } from "react";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

async function apiJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok)
    throw new Error(data?.error || `Failed (${res.status})`);
  return data;
}

export default function AuditPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const card =
    "rounded-3xl border border-admin-border/30 bg-white/70 shadow-sm";
  const input =
    "rounded-2xl border border-admin-border/30 bg-white/80 px-3 py-2 text-sm text-admin-text placeholder:text-admin-text/40 outline-none focus:ring-2 focus:ring-[#66ccff]/40";

  async function load() {
    try {
      setErr("");
      setLoading(true);
      const usp = new URLSearchParams();
      if (q) usp.set("q", q);
      if (entityType) usp.set("entityType", entityType);
      usp.set("limit", "80");

      const data = await apiJson(`/api/admin/audit?${usp.toString()}`);
      setItems(data.items || []);
    } catch (e) {
      setErr(e.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => items || [], [items]);

  return (
    <div className="text-admin-text min-h-0">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <p className="text-sm text-admin-text/60">
          ดูประวัติการเปลี่ยนแปลง พร้อมชื่อ/รูปผู้แก้ไข และ diff รายฟิลด์
        </p>
      </div>

      <div className={cx("mb-4 p-4", card)}>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            className={input}
            placeholder="ค้นหา (ชื่อผู้แก้ไข / username / ชื่อรายการ)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className={input}
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            <option value="">All entity types</option>
            <option value="class">class</option>
            <option value="event">event</option>
            <option value="food">food</option>
            <option value="student">student</option>
            <option value="receipt">receipt</option>
            <option value="account">account</option>
          </select>

          <button
            onClick={load}
            className="rounded-2xl px-4 py-2 text-sm font-medium bg-[#66ccff] text-black hover:bg-[#7ad6ff]"
          >
            Refresh
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className={cx("p-4", card)}>
        {loading ? (
          <div className="text-sm text-admin-text/60">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-admin-text/60">No logs</div>
        ) : (
          <div className="space-y-3">
            {rows.map((it) => (
              <div
                key={it.id}
                className="rounded-2xl border border-admin-border/25 bg-white/80 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full overflow-hidden border border-admin-border/20 bg-black/5">
                    {it.actor?.avatarUrl ? (
                      <img
                        src={it.actor.avatarUrl}
                        alt="avatar"
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 grid place-items-center text-xs text-admin-text/40">
                        —
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold">
                        {it.actor?.name || it.actor?.username || "Unknown"}
                      </div>
                      <div className="text-xs text-admin-text/60">
                        ({it.actor?.roleCode || "-"})
                      </div>

                      <span className="ml-auto rounded-full bg-black/5 px-2 py-1 text-xs text-admin-text/70">
                        {new Date(it.createdAt).toLocaleString("th-TH")}
                      </span>
                    </div>

                    <div className="mt-1 text-sm">
                      <span className="font-semibold">{it.action}</span>{" "}
                      <span className="text-admin-text/70">
                        {it.entityType}:{it.entityId}
                      </span>
                      {it.entityLabel ? (
                        <span className="text-admin-text/60">
                          {" "}
                          • {it.entityLabel}
                        </span>
                      ) : null}
                    </div>

                    {Array.isArray(it.diffs) && it.diffs.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-admin-text/70">
                          ดูรายละเอียดที่เปลี่ยน ({it.diffs.length})
                        </summary>
                        <div className="mt-2 overflow-auto">
                          <table className="w-full text-xs">
                            <thead className="text-admin-text/60">
                              <tr className="text-left border-b border-admin-border/20">
                                <th className="py-2 pr-3">Field</th>
                                <th className="py-2 pr-3">Before</th>
                                <th className="py-2 pr-3">After</th>
                              </tr>
                            </thead>
                            <tbody>
                              {it.diffs.slice(0, 80).map((d, idx) => (
                                <tr
                                  key={idx}
                                  className="border-b border-admin-border/15"
                                >
                                  <td className="py-2 pr-3 font-medium">
                                    {d.path}
                                  </td>
                                  <td className="py-2 pr-3 text-admin-text/70">
                                    {formatVal(d.before)}
                                  </td>
                                  <td className="py-2 pr-3 text-admin-text/80">
                                    {formatVal(d.after)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatVal(v) {
  if (v === null || v === undefined) return "-";
  if (typeof v === "string") return v.length > 120 ? v.slice(0, 120) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 120 ? s.slice(0, 120) + "…" : s;
  } catch {
    return String(v);
  }
}
