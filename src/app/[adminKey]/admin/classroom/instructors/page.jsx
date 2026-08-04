"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
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
};

/** Source badge shown next to a resolved signature. */
function SourceBadge({ source }) {
  if (!source) return null;
  const isLocal = source === "local";
  return (
    <span
      className={cx(
        "rounded-lg px-2 py-0.5 text-[10px] font-medium",
        isLocal
          ? "bg-[#66ccff]/20 text-admin-text"
          : "bg-amber-400/20 text-amber-800",
      )}
      title={
        isLocal
          ? "อัปโหลดในระบบนี้"
          : "ได้จากระบบต้นทาง (MSDB) — อัปโหลดเองเพื่อแทนที่ได้"
      }
    >
      {isLocal ? "local" : "upstream"}
    </span>
  );
}

export default function InstructorSignaturesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);

  // upload dialog state
  const [target, setTarget] = useState(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  async function load() {
    try {
      setErr("");
      setLoading(true);
      const params = new URLSearchParams();
      if (clean(q)) params.set("q", clean(q));
      if (onlyMissing) params.set("onlyMissing", "1");

      const data = await apiJson(
        `/api/admin/instructors/signatures?${params.toString()}`,
        { cache: "no-store" },
      );
      setItems(data.items || []);
    } catch (e) {
      setErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyMissing]);

  function openUpload(it) {
    setTarget(it);
    setPreview("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function closeUpload() {
    setTarget(null);
    setPreview("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onPickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      toast.error("รองรับเฉพาะไฟล์ PNG / JPG / WEBP");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("ไฟล์ใหญ่เกิน 2 MB");
      e.target.value = "";
      return;
    }

    try {
      setPreview(await readFileAsDataUrl(file));
    } catch (error) {
      toast.error(error.message || "อ่านไฟล์ไม่สำเร็จ");
    }
  }

  async function saveSignature() {
    if (!target || !preview) return;
    try {
      setSaving(true);
      await apiJson("/api/admin/instructors/signatures", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: target.name,
          email: target.email,
          code: target.code,
          externalId: target.externalId,
          dataUrl: preview,
        }),
      });
      toast.success(`บันทึกลายเซ็นของ ${target.name || "อาจารย์"} แล้ว`);
      closeUpload();
      await load();
    } catch (e) {
      toast.error(e.message || "บันทึกลายเซ็นไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function removeSignature(it) {
    if (!confirm(`ลบลายเซ็นของ ${it.name || it.key} ใช่ไหม?`)) return;
    try {
      await apiJson(
        `/api/admin/instructors/signatures?key=${encodeURIComponent(it.key)}`,
        { method: "DELETE" },
      );
      toast.success("ลบลายเซ็นแล้ว");
      await load();
    } catch (e) {
      toast.error(e.message || "ลบลายเซ็นไม่สำเร็จ");
    }
  }

  const rows = useMemo(() => items || [], [items]);
  const missingCount = useMemo(
    () => rows.filter((r) => !r.hasSignature).length,
    [rows],
  );

  return (
    <div className="min-h-0 text-admin-text">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">ลายเซ็นอาจารย์</h1>
        <p className="text-sm text-admin-text/60">
          อัปโหลดลายเซ็นของอาจารย์เพื่อใช้กับ External API และเอกสารที่ต้องมีลายเซ็น
          (แนะนำไฟล์ PNG พื้นหลังโปร่งใส)
        </p>
      </div>

      {err && (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Filters */}
      <div className={cx("mb-6 p-4", UI.card)}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <form
            className="flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            <input
              className={UI.input}
              placeholder="ค้นหาชื่ออาจารย์ / อีเมล / รหัส"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </form>

          <label className="flex select-none items-center gap-2 text-sm text-admin-text/80">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#66ccff]"
              checked={onlyMissing}
              onChange={(e) => setOnlyMissing(e.target.checked)}
            />
            แสดงเฉพาะที่ยังไม่มีลายเซ็น
          </label>

          <button type="button" className={UI.btnPrimary} onClick={load}>
            ค้นหา
          </button>
        </div>

        <div className="mt-3 text-xs text-admin-text/50">
          ทั้งหมด {rows.length} รายการ • ยังไม่มีลายเซ็น {missingCount} รายการ
        </div>
      </div>

      {/* Table */}
      <div className={cx("overflow-hidden", UI.card)}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead className="border-b border-admin-border/20 bg-white/40">
              <tr>
                <th className={UI.th}>อาจารย์</th>
                <th className={UI.th}>อีเมล</th>
                <th className={UI.th}>รหัส</th>
                <th className={UI.th}>สถานะลายเซ็น</th>
                <th className={cx(UI.th, "text-right")}>จัดการ</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td className={cx(UI.td, "text-admin-text/50")} colSpan={5}>
                    กำลังโหลด…
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td className={cx(UI.td, "text-admin-text/50")} colSpan={5}>
                    ไม่พบข้อมูลอาจารย์
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((it) => (
                  <tr
                    key={it.key || it.name}
                    className="border-b border-admin-border/10 last:border-0"
                  >
                    <td className={UI.td}>
                      <div className="font-medium">{it.name || "-"}</div>
                      {it.nameEn ? (
                        <div className="text-xs text-admin-text/50">
                          {it.nameEn}
                        </div>
                      ) : (
                        <div className="text-xs text-admin-text/30">
                          ยังไม่มีชื่อภาษาอังกฤษ (MSDB)
                        </div>
                      )}
                      {it.origin === "orphan" && (
                        <div className="text-[10px] text-amber-700">
                          ไม่พบในรายชื่ออาจารย์จากระบบต้นทาง
                        </div>
                      )}
                    </td>

                    <td className={cx(UI.td, "text-admin-text/70")}>
                      {it.email || "-"}
                    </td>

                    <td className={cx(UI.td, "text-admin-text/70")}>
                      {it.code || "-"}
                    </td>

                    <td className={UI.td}>
                      {it.hasSignature ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={it.signatureUrl}
                            alt={`ลายเซ็น ${it.name}`}
                            className="h-10 w-auto max-w-[140px] rounded-lg border border-admin-border/20 bg-white object-contain p-1"
                          />
                          <SourceBadge source={it.source} />
                        </div>
                      ) : (
                        <span className="text-admin-text/40">ยังไม่มี</span>
                      )}
                    </td>

                    <td className={cx(UI.td, "text-right")}>
                      <div className="inline-flex gap-2">
                        {/* Upload stays available for upstream rows too: a
                            local signature is tier 1 and overrides upstream. */}
                        <button
                          type="button"
                          className={UI.btnGhost}
                          onClick={() => openUpload(it)}
                        >
                          {it.source === "upstream"
                            ? "แทนที่ด้วยลายเซ็นที่อัปโหลดเอง"
                            : it.hasSignature
                              ? "เปลี่ยนลายเซ็น"
                              : "อัปโหลดลายเซ็น"}
                        </button>

                        {it.hasSignature && it.source === "local" && (
                          <button
                            type="button"
                            className={UI.btnDanger}
                            onClick={() => removeSignature(it)}
                          >
                            ลบ
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload dialog */}
      <Dialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open) closeUpload();
        }}
      >
        <DialogContent className="rounded-3xl bg-white text-admin-text">
          <DialogHeader>
            <DialogTitle>อัปโหลดลายเซ็น</DialogTitle>
            <DialogDescription>
              {target?.name || ""} — แนะนำไฟล์ PNG พื้นหลังโปร่งใส ขนาดไม่เกิน 2 MB
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onPickFile}
              className="block w-full text-sm text-admin-text/80 file:mr-3 file:rounded-xl file:border-0 file:bg-[#66ccff] file:px-3 file:py-2 file:text-sm file:text-black"
            />

            {preview ? (
              <div className="rounded-2xl border border-admin-border/20 bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#ffffff_0%_50%)] bg-[length:16px_16px] p-4">
                <img
                  src={preview}
                  alt="ตัวอย่างลายเซ็น"
                  className="mx-auto h-24 w-auto object-contain"
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-admin-border/30 px-4 py-8 text-center text-sm text-admin-text/40">
                ยังไม่ได้เลือกไฟล์
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              className={UI.btnGhost}
              onClick={closeUpload}
              disabled={saving}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              className={preview && !saving ? UI.btnPrimary : UI.btnDisabled}
              onClick={saveSignature}
              disabled={!preview || saving}
            >
              {saving ? "กำลังบันทึก…" : "บันทึกลายเซ็น"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
