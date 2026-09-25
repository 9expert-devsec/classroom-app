"use client";

// src/app/[adminKey]/admin/classroom/kiosks/page.jsx
// L2b: kiosk / tablet sessions - live first, then the last 7 days; revoke one
// or all live sessions. View and revoke both need CLASSROOM_OPERATE.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
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

async function apiJson(url, opts) {
  const res = await fetch(url, { cache: "no-store", ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function fmtDateTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
}

const UI = {
  card: "rounded-3xl border border-admin-border/30 bg-white/70 shadow-sm",
  btnGhost:
    "rounded-xl border border-admin-border/30 bg-white/70 px-3 py-1.5 text-xs text-admin-text hover:bg-white",
  btnDanger:
    "rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-700 hover:bg-red-500/20 disabled:opacity-50",
  btnDangerSolid:
    "rounded-2xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50",
  th: "px-4 py-3 text-left text-xs font-semibold text-admin-text/60",
  td: "px-4 py-3 text-sm align-middle",
};

const TONE = {
  live: "bg-emerald-500/15 text-emerald-700",
  expired: "bg-black/5 text-admin-text/60",
  closed: "bg-black/5 text-admin-text/60",
  revoked: "bg-red-500/15 text-red-700",
};

function StatusPill({ row }) {
  return (
    <span
      className={cx(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        TONE[row.status] || TONE.expired,
      )}
    >
      {row.statusLabel}
    </span>
  );
}

function SessionTable({ rows, onRevoke, busyId, emptyText }) {
  return (
    <div className={cx("overflow-hidden", UI.card)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse">
          <thead className="border-b border-admin-border/20 bg-white/40">
            <tr>
              <th className={UI.th}>อุปกรณ์</th>
              <th className={UI.th}>เปิดโดย</th>
              <th className={UI.th}>เปิดเมื่อ</th>
              <th className={UI.th}>หมดอายุ</th>
              <th className={UI.th}>ใช้งานล่าสุด</th>
              <th className={UI.th}>IP / เครื่อง</th>
              <th className={UI.th}>โหมดเจ้าหน้าที่</th>
              <th className={UI.th}>สถานะ</th>
              <th className={cx(UI.th, "text-right")}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className={cx(UI.td, "text-admin-text/50")} colSpan={9}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-admin-border/10 last:border-0">
                  <td className={cx(UI.td, "font-medium")}>{r.label}</td>
                  <td className={UI.td}>{r.openedByName || "-"}</td>
                  <td className={UI.td}>{fmtDateTime(r.openedAt)}</td>
                  <td className={UI.td}>{fmtDateTime(r.expiresAt)}</td>
                  <td className={UI.td}>{fmtDateTime(r.lastSeenAt)}</td>
                  <td className={cx(UI.td, "text-xs text-admin-text/70")}>
                    <div>{r.ip || "-"}</div>
                    <div>{r.userAgent || ""}</div>
                  </td>
                  <td className={UI.td}>
                    {r.staffUnlocked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-medium text-amber-800">
                        <ShieldCheck className="h-3 w-3" />
                        {r.staffUnlockByName || "ปลดล็อกอยู่"}
                      </span>
                    ) : (
                      <span className="text-xs text-admin-text/40">-</span>
                    )}
                  </td>
                  <td className={UI.td}>
                    <StatusPill row={r} />
                  </td>
                  <td className={cx(UI.td, "text-right")}>
                    {r.status === "live" ? (
                      <button
                        type="button"
                        className={UI.btnDanger}
                        disabled={busyId === r.id}
                        onClick={() => onRevoke(r)}
                      >
                        เพิกถอน
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function KiosksPage() {
  const [live, setLive] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // confirm = { kind: "one", row } | { kind: "all", count }
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiJson("/api/admin/kiosks");
      setLive(data.live || []);
      setRecent(data.recent || []);
    } catch (e) {
      setError(
        e.status === 403
          ? "บัญชีนี้ไม่มีสิทธิ์ดูหน้านี้ (ต้องมีสิทธิ์ classroom.operate)"
          : e.message,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function doConfirm() {
    if (!confirm || busy) return;
    setBusy(true);
    try {
      if (confirm.kind === "one") {
        await apiJson("/api/admin/kiosks/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: confirm.row.id }),
        });
        toast.success(`เพิกถอน “${confirm.row.label}” แล้ว`);
      } else {
        const data = await apiJson("/api/admin/kiosks/revoke-all", {
          method: "POST",
        });
        toast.success(`เพิกถอนแล้ว ${data.count} เครื่อง`);
      }
      setConfirm(null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
      load();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col text-admin-text">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Kiosk / Tablet</h1>
          <p className="text-sm text-admin-text/60">
            แท็บเล็ตหน้างานที่เปิด kiosk ไว้ — kiosk หมดอายุเองเวลา 23:59 น.
            ของวันที่เปิด หากเครื่องหายหรือไม่ใช้แล้วให้เพิกถอนได้ทันที
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" className={UI.btnGhost} onClick={load}>
            รีเฟรช
          </button>
          <button
            type="button"
            className={UI.btnDanger}
            disabled={live.length === 0}
            onClick={() => setConfirm({ kind: "all", count: live.length })}
          >
            เพิกถอนทั้งหมด
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-6">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section>
          <h2 className="mb-2 text-sm font-semibold">
            ใช้งานอยู่ {loading ? "" : `(${live.length})`}
          </h2>
          <SessionTable
            rows={live}
            busyId={busy && confirm?.kind === "one" ? confirm.row.id : ""}
            onRevoke={(row) => setConfirm({ kind: "one", row })}
            emptyText={loading ? "กำลังโหลด…" : "ไม่มี kiosk ที่ใช้งานอยู่"}
          />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">ย้อนหลัง 7 วัน</h2>
          <SessionTable
            rows={recent}
            busyId=""
            onRevoke={() => {}}
            emptyText={loading ? "กำลังโหลด…" : "ไม่มีประวัติ"}
          />
        </section>
      </div>

      <Dialog open={!!confirm} onOpenChange={(v) => !v && !busy && setConfirm(null)}>
        <DialogContent className="rounded-3xl bg-white text-admin-text">
          <DialogHeader>
            <DialogTitle>
              {confirm?.kind === "all"
                ? `เพิกถอน kiosk ทั้งหมด ${confirm.count} เครื่อง?`
                : `เพิกถอน “${confirm?.row?.label || ""}”?`}
            </DialogTitle>
            <DialogDescription>
              {confirm?.kind === "all"
                ? `แท็บเล็ตทั้ง ${confirm?.count} เครื่องจะใช้งานหน้างานไม่ได้ทันที จนกว่าเจ้าหน้าที่จะเปิด kiosk ใหม่`
                : "แท็บเล็ตเครื่องนี้จะใช้งานหน้างานไม่ได้ทันที จนกว่าเจ้าหน้าที่จะเปิด kiosk ใหม่"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              type="button"
              className={UI.btnGhost}
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              className={UI.btnDangerSolid}
              disabled={busy}
              onClick={doConfirm}
            >
              {busy ? "กำลังเพิกถอน…" : "เพิกถอน"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
