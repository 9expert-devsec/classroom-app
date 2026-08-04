"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}
function clean(x) {
  return String(x || "").trim();
}

async function apiJson(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    const msg = data?.error || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

function fmtDateTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

/** Split a textarea into trimmed non-empty lines. */
function toLines(text) {
  return String(text || "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const UI = {
  card: "rounded-3xl border border-admin-border/30 bg-white/70 shadow-sm",
  input:
    "w-full rounded-2xl border border-admin-border/30 bg-white/80 px-3 py-2 text-sm text-admin-text placeholder:text-admin-text/40 outline-none focus:ring-2 focus:ring-[#66ccff]/40",
  btnPrimary:
    "rounded-2xl px-4 py-2 text-sm font-medium bg-[#66ccff] text-black hover:bg-[#7ad6ff]",
  btnDisabled:
    "rounded-2xl px-4 py-2 text-sm font-medium bg-black/10 text-admin-text/40 cursor-not-allowed",
  btnGhost:
    "rounded-xl border border-admin-border/30 bg-white/70 px-3 py-1.5 text-xs text-admin-text hover:bg-white",
  btnDanger:
    "rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-700 hover:bg-red-500/20",
  th: "px-4 py-3 text-left text-xs font-semibold text-admin-text/60",
  td: "px-4 py-3 text-sm align-middle",
  label: "mb-1 block text-xs font-medium text-admin-text/70",
};

function statusOf(it) {
  if (it.revokedAt) return { label: "ยกเลิกแล้ว", tone: "danger" };
  if (it.expiresAt && new Date(it.expiresAt).getTime() < Date.now()) {
    return { label: "หมดอายุ", tone: "warn" };
  }
  return { label: "ใช้งานได้", tone: "ok" };
}

function StatusPill({ it }) {
  const s = statusOf(it);
  const tone =
    s.tone === "ok"
      ? "bg-emerald-500/15 text-emerald-700"
      : s.tone === "warn"
        ? "bg-amber-400/20 text-amber-800"
        : "bg-red-500/15 text-red-700";
  return (
    <span className={cx("rounded-lg px-2 py-0.5 text-[11px] font-medium", tone)}>
      {s.label}
    </span>
  );
}

const EMPTY_FORM = {
  name: "",
  allowedOrigins: "",
  allowedIps: "",
  rateLimitPerMin: "60",
  expiresAt: "",
  note: "",
};

export default function ApiKeysPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  // One-time reveal panel. Cleared as soon as the admin dismisses it.
  const [issued, setIssued] = useState(null);

  async function load() {
    try {
      setErr("");
      setLoading(true);
      const data = await apiJson("/api/admin/api-keys", { cache: "no-store" });
      setItems(data.items || []);
    } catch (e) {
      setErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createKey() {
    if (!clean(form.name)) {
      toast.error("ต้องระบุชื่อคีย์");
      return;
    }
    try {
      setCreating(true);
      const data = await apiJson("/api/admin/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: clean(form.name),
          scopes: ["classes.read"],
          allowedOrigins: toLines(form.allowedOrigins),
          allowedIps: toLines(form.allowedIps),
          rateLimitPerMin: Number(form.rateLimitPerMin) || 60,
          expiresAt: clean(form.expiresAt),
          note: clean(form.note),
        }),
      });

      setIssued({ rawKey: data.rawKey, item: data.item });
      setOpenCreate(false);
      setForm(EMPTY_FORM);
      toast.success("สร้างคีย์แล้ว");
      await load();
    } catch (e) {
      toast.error(e.message || "สร้างคีย์ไม่สำเร็จ");
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(it) {
    if (
      !confirm(
        `ยกเลิกคีย์ "${it.name}" ใช่ไหม?\nพาร์ทเนอร์ที่ใช้คีย์นี้จะเรียก API ไม่ได้ทันที และกู้คืนไม่ได้`,
      )
    ) {
      return;
    }
    try {
      await apiJson(`/api/admin/api-keys/${it.id}`, { method: "DELETE" });
      toast.success("ยกเลิกคีย์แล้ว");
      await load();
    } catch (e) {
      toast.error(e.message || "ยกเลิกคีย์ไม่สำเร็จ");
    }
  }

  async function copy(text, okMsg) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(okMsg);
    } catch {
      toast.error("คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง");
    }
  }

  const curlCommand = useMemo(() => {
    if (!issued?.rawKey) return "";
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return `curl -i -H "x-api-key: ${issued.rawKey}" "${origin}/api/ext/v1/health"`;
  }, [issued]);

  const rows = items || [];

  return (
    <div className="min-h-0 text-admin-text">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">API Keys</h1>
          <p className="text-sm text-admin-text/60">
            คีย์สำหรับให้เว็บไซต์พาร์ทเนอร์ในเครือเรียกดูตารางสอนผ่าน External API
            (อ่านอย่างเดียว ไม่มีข้อมูลผู้เรียน)
          </p>
        </div>
        <button
          type="button"
          className={UI.btnPrimary}
          onClick={() => setOpenCreate(true)}
        >
          + สร้างคีย์ใหม่
        </button>
      </div>

      {err && (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* One-time key reveal */}
      {issued && (
        <div className="mb-6 rounded-3xl border-2 border-amber-400/60 bg-amber-50/80 p-5 shadow-sm">
          <div className="mb-2 text-sm font-semibold text-amber-900">
            คัดลอกคีย์นี้เก็บไว้ทันที
          </div>
          <p className="mb-3 text-sm text-amber-900/80">
            ระบบเก็บเฉพาะค่าที่เข้ารหัสไว้ <b>จะไม่แสดงคีย์เต็มนี้อีกเป็นครั้งที่สอง</b>{" "}
            ถ้าทำหาย ต้องยกเลิกคีย์เดิมแล้วสร้างใหม่เท่านั้น
          </p>

          <div className="mb-3 break-all rounded-2xl border border-amber-400/40 bg-white px-4 py-3 font-mono text-sm">
            {issued.rawKey}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={UI.btnPrimary}
              onClick={() => copy(issued.rawKey, "คัดลอกคีย์แล้ว")}
            >
              คัดลอกคีย์
            </button>

            <button
              type="button"
              className={UI.btnGhost}
              onClick={() =>
                copy(curlCommand, "คัดลอกคำสั่งทดสอบแล้ว วางใน terminal ได้เลย")
              }
              title={curlCommand}
            >
              ทดสอบคีย์นี้ (คัดลอกคำสั่ง curl)
            </button>

            <button
              type="button"
              className={UI.btnGhost}
              onClick={() => setIssued(null)}
            >
              ปิด (เก็บคีย์เรียบร้อยแล้ว)
            </button>
          </div>

          <div className="mt-3 rounded-xl bg-white/60 px-3 py-2 font-mono text-[11px] text-admin-text/60 break-all">
            {curlCommand}
          </div>
          <div className="mt-1 text-[11px] text-amber-900/60">
            หมายเหตุ: endpoint /api/ext/v1/health จะพร้อมใช้งานหลัง Phase 3
            ตอนนี้เรียกแล้วยังได้ 404 เป็นเรื่องปกติ
          </div>
        </div>
      )}

      {/* Table */}
      <div className={cx("overflow-hidden", UI.card)}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead className="border-b border-admin-border/20 bg-white/40">
              <tr>
                <th className={UI.th}>ชื่อ</th>
                <th className={UI.th}>Prefix</th>
                <th className={UI.th}>Scopes</th>
                <th className={UI.th}>Origins</th>
                <th className={UI.th}>ใช้ล่าสุด</th>
                <th className={UI.th}>จำนวน request</th>
                <th className={UI.th}>สถานะ</th>
                <th className={cx(UI.th, "text-right")}>จัดการ</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td className={cx(UI.td, "text-admin-text/50")} colSpan={8}>
                    กำลังโหลด…
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td className={cx(UI.td, "text-admin-text/50")} colSpan={8}>
                    ยังไม่มีคีย์ — กด “สร้างคีย์ใหม่” เพื่อเริ่มต้น
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((it) => (
                  <tr
                    key={it.id}
                    className="border-b border-admin-border/10 last:border-0"
                  >
                    <td className={UI.td}>
                      <div className="font-medium">{it.name}</div>
                      {it.note && (
                        <div className="text-xs text-admin-text/50">
                          {it.note}
                        </div>
                      )}
                      {it.expiresAt && (
                        <div className="text-xs text-admin-text/40">
                          หมดอายุ {fmtDateTime(it.expiresAt)}
                        </div>
                      )}
                    </td>

                    <td className={cx(UI.td, "font-mono text-xs")}>
                      {it.keyPrefix}…
                    </td>

                    <td className={cx(UI.td, "text-xs text-admin-text/70")}>
                      {(it.scopes || []).join(", ") || "-"}
                    </td>

                    <td className={cx(UI.td, "text-xs text-admin-text/70")}>
                      {it.allowedOrigins?.length ? (
                        it.allowedOrigins.map((o) => <div key={o}>{o}</div>)
                      ) : (
                        <span className="text-admin-text/40">
                          server-to-server เท่านั้น
                        </span>
                      )}
                    </td>

                    <td className={cx(UI.td, "text-xs text-admin-text/70")}>
                      <div>{fmtDateTime(it.lastUsedAt)}</div>
                      {it.lastUsedIp && (
                        <div className="text-admin-text/40">{it.lastUsedIp}</div>
                      )}
                    </td>

                    <td className={UI.td}>
                      {Number(it.requestCount || 0).toLocaleString()}
                    </td>

                    <td className={UI.td}>
                      <StatusPill it={it} />
                    </td>

                    <td className={cx(UI.td, "text-right")}>
                      {!it.revokedAt && (
                        <button
                          type="button"
                          className={UI.btnDanger}
                          onClick={() => revokeKey(it)}
                        >
                          ยกเลิกคีย์
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl bg-white text-admin-text">
          <DialogHeader>
            <DialogTitle>สร้าง API Key ใหม่</DialogTitle>
            <DialogDescription>
              คีย์นี้อ่านได้เฉพาะข้อมูลตารางสอน (scope: classes.read)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className={UI.label}>ชื่อคีย์ *</label>
              <input
                className={UI.input}
                placeholder="Partner: 9expert.com"
                value={form.name}
                onChange={(e) =>
                  setForm((s) => ({ ...s, name: e.target.value }))
                }
              />
            </div>

            <div>
              <label className={UI.label}>
                Allowed Origins (บรรทัดละ 1 รายการ — เว้นว่างถ้าเรียกจากเซิร์ฟเวอร์เท่านั้น)
              </label>
              <textarea
                className={cx(UI.input, "h-20 resize-none font-mono text-xs")}
                placeholder={"https://9expert.com\nhttps://www.9expert.com"}
                value={form.allowedOrigins}
                onChange={(e) =>
                  setForm((s) => ({ ...s, allowedOrigins: e.target.value }))
                }
              />
            </div>

            <div>
              <label className={UI.label}>
                Allowed IPs (บรรทัดละ 1 รายการ — เว้นว่าง = ทุก IP)
              </label>
              <textarea
                className={cx(UI.input, "h-16 resize-none font-mono text-xs")}
                placeholder="203.0.113.10"
                value={form.allowedIps}
                onChange={(e) =>
                  setForm((s) => ({ ...s, allowedIps: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className={UI.label}>Rate limit (ครั้ง/นาที)</label>
                <input
                  className={UI.input}
                  type="number"
                  min="1"
                  value={form.rateLimitPerMin}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, rateLimitPerMin: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className={UI.label}>วันหมดอายุ (เว้นว่าง = ไม่หมดอายุ)</label>
                <input
                  className={UI.input}
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, expiresAt: e.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <label className={UI.label}>หมายเหตุ</label>
              <input
                className={UI.input}
                placeholder="ผู้ติดต่อ / วัตถุประสงค์"
                value={form.note}
                onChange={(e) =>
                  setForm((s) => ({ ...s, note: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              className={UI.btnGhost}
              onClick={() => setOpenCreate(false)}
              disabled={creating}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              className={creating ? UI.btnDisabled : UI.btnPrimary}
              onClick={createKey}
              disabled={creating}
            >
              {creating ? "กำลังสร้าง…" : "สร้างคีย์"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
