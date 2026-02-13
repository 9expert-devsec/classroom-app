// src/app/classroom/receive/customer/page.jsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import SignaturePad from "@/components/shared/SignaturePad";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function clean(x) {
  return String(x || "").trim();
}

function formatDateTH(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function toLabelReceiveType(x) {
  const v = clean(x);
  if (v === "on_class") return "มารับ ณ วันอบรม";
  if (v === "ems") return "ส่งทางไปรษณีย์";
  return v || "-";
}

export default function ReceiveCustomerPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [todayYMD, setTodayYMD] = useState("");
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const [sigDataUrl, setSigDataUrl] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const hintText = useMemo(() => {
    return todayYMD
      ? `ระบบจะแสดงเฉพาะผู้ที่เช็คอินแล้วใน “วันนี้” (${todayYMD})`
      : "พิมพ์ชื่อ/บริษัท/เลขที่ QT/IV/RP เพื่อค้นหา";
  }, [todayYMD]);

  async function doSearch() {
    const qq = clean(q);

    setErr("");
    setSelected(null);
    setSigDataUrl("");
    setItems([]); // ✅ กันรายการค้าง

    if (!qq) {
      setErr("กรุณาพิมพ์คำค้นหา (ชื่อ/บริษัท/เลขที่ INV...)");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/classroom/receive/customer/search?q=${encodeURIComponent(qq)}`,
        { cache: "no-store" },
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false) {
        setTodayYMD(data?.today || "");
        setErr(data?.error || "ค้นหาไม่สำเร็จ");
        setItems([]);
        return;
      }

      setTodayYMD(data?.today || "");
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setItems([]);
      setErr("เกิดข้อผิดพลาดในการค้นหา");
    } finally {
      setLoading(false);
    }
  }

  async function confirmReceive() {
    if (!selected) return;
    setErr("");

    if (!sigDataUrl) {
      setErr("กรุณาเซ็นชื่อในกรอบด้านบน");
      return;
    }

    const ok = window.confirm("ยืนยันการรับเอกสาร และบันทึกลายเซ็นใช่หรือไม่?");
    if (!ok) return;

    setSaving(true);
    try {
      const res = await fetch("/api/classroom/receive/customer/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          classId: selected.classId,
          docId: selected.docIdNormalized || selected.docId,
          receiverIndex: Number(selected.receiverIndex || 0),
          signatureDataUrl: sigDataUrl,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        setErr(data?.error || "บันทึกไม่สำเร็จ");
        return;
      }

      alert("บันทึกการรับเอกสารเรียบร้อยแล้ว");
      // ✅ refresh 1 ครั้ง เพื่อให้คนถัดไปค้นหาใหม่
      window.location.reload();
    } catch (e) {
      setErr("เกิดข้อผิดพลาดขณะบันทึก");
    } finally {
      setSaving(false);
    }
  }

  function openConfirmDialog() {
    if (!selected) return;
    setErr("");

    if (!sigDataUrl) {
      setErr("กรุณาเซ็นชื่อในกรอบด้านบน");
      return;
    }

    setConfirmOpen(true);
  }

  async function doConfirmReceive() {
    if (!selected) return;

    setSaving(true);
    setErr("");

    try {
      const res = await fetch("/api/classroom/receive/customer/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          classId: selected.classId,
          docId: selected.docIdNormalized || selected.docId,
          receiverIndex: Number(selected.receiverIndex || 0),
          signatureDataUrl: sigDataUrl,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        setErr(data?.error || "บันทึกไม่สำเร็จ");
        return;
      }

      // ปิด confirm แล้วเปิด success
      setConfirmOpen(false);
      setSuccessOpen(true);
    } catch (e) {
      setErr("เกิดข้อผิดพลาดขณะบันทึก");
    } finally {
      setSaving(false);
    }
  }

  const hasSearched = useMemo(() => {
    // ถือว่า searched เมื่อมี todayYMD หรือ loading/err หลังจากกดค้นหา
    return !!todayYMD || loading || !!err || items.length > 0 || !!selected;
  }, [todayYMD, loading, err, items.length, selected]);

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-4 flex items-start gap-3">
        <Link
          href="/classroom"
          className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-admin-border bg-white text-admin-text hover:bg-admin-surfaceMuted"
          aria-label="ย้อนกลับ"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>

        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-wide text-admin-textMuted">
            Receive
          </div>
          <h1 className="mt-1 text-lg font-semibold text-admin-text">
            รับเอกสาร (ลูกค้ารับเอกสาร)
          </h1>
          <div className="mt-1 text-sm text-admin-textMuted">{hintText}</div>
        </div>
      </div>

      {/* Step 1 */}
      <div className="rounded-2xl border border-admin-border bg-white p-4">
        <div className="text-sm font-semibold text-admin-text">
          Step 1: ค้นหา
        </div>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="พิมพ์ชื่อ / บริษัท / เลขที่ QT/IV/RP เช่น INV-001, INV 001"
            className="w-full rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
            onKeyDown={(e) => {
              if (e.key === "Enter") doSearch();
            }}
          />
          <button
            type="button"
            onClick={doSearch}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "กำลังค้นหา..." : "ค้นหา"}
          </button>
        </div>

        {hasSearched && (
          <div className="mt-3 text-sm text-admin-textMuted">
            พบ {items.length} รายการ
            {todayYMD ? <span> (Today: {todayYMD})</span> : null}
          </div>
        )}

        {err && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="mt-4">
        {/* ✅ ถ้าเลือกแล้ว: โชว์เฉพาะ 1 รายการ (ไม่ให้รายการค้างหลายใบ) */}
        {selected ? (
          <div className="space-y-3">
            <div
              className="w-full text-left rounded-2xl border p-4 border-brand-primary bg-brand-primary/5"
              // className={cx(
              //   "w-full text-left rounded-2xl border p-4",
              //   "border-brand-primary bg-brand-primary/5",
              // )}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-base font-semibold text-admin-text">
                    {selected.name}
                  </div>
                  <div className="text-sm text-admin-textMuted">
                    {selected.company || "-"}
                  </div>
                </div>

                <div className="text-sm text-admin-textMuted">
                  <span className="font-medium text-admin-text">QT/IV/RP:</span>{" "}
                  {selected.docIdNormalized || selected.docId || "-"}
                </div>
              </div>

              <div className="mt-3 rounded-2xl bg-admin-surface p-3 text-sm text-admin-text">
                <div className="font-medium">
                  Class: {selected.classInfo?.title || "-"}
                </div>
                <div className="mt-1 text-admin-textMuted">
                  วันอบรม: {selected.classInfo?.dateText || "-"} • ห้อง:{" "}
                  {selected.classInfo?.roomName || "-"}
                </div>
                <div className="mt-1 text-admin-textMuted">
                  วันนี้คือ Day {selected.dayIndex || "-"} • ช่องทางรับเอกสาร:{" "}
                  {toLabelReceiveType(selected.documentReceiveType)}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {selected.documentReceivedAt ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      รับเอกสารแล้ว ({formatDateTH(selected.documentReceivedAt)}
                      )
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                      ยังไม่รับเอกสาร
                    </span>
                  )}

                  {!!selected.signedUrl ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      มีลายเซ็นแล้ว
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                      รอเซ็น
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setSigDataUrl("");
                    setErr("");
                    setItems([]);
                  }}
                  className="rounded-lg border border-admin-border bg-white px-3 py-1.5 text-xs text-admin-text hover:bg-admin-surfaceMuted"
                >
                  เลือกคนอื่น
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {items.length > 0 ? (
              <div className="space-y-3">
                {items.map((it, idx) => {
                  const signed = !!it.signedUrl;

                  return (
                    <button
                      key={`${it.studentId}-${it.classId}-${idx}`}
                      type="button"
                      onClick={() => {
                        setSelected(it);
                        setSigDataUrl("");
                        setErr("");
                      }}
                      className={cx(
                        "w-full text-left rounded-2xl border p-4 transition",
                        "border-[#48B0FF] bg-white hover:bg-admin-surfaceMuted/40",
                        signed ? "opacity-90" : "",
                      )}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-base font-semibold text-admin-text">
                            {it.name}
                          </div>
                          <div className="text-sm text-admin-textMuted">
                            {it.company || "-"}
                          </div>
                        </div>

                        <div className="text-sm text-admin-textMuted">
                          <span className="font-medium text-admin-text">
                            QT/IV/RP:
                          </span>{" "}
                          {it.docIdNormalized || it.docId || "-"}
                        </div>
                      </div>

                      <div className="mt-3 rounded-2xl bg-[#48B0FF]/20 p-3 text-sm text-admin-text">
                        <div className="font-medium">
                          Class: {it.classInfo?.title || "-"}
                        </div>
                        <div className="mt-1 text-admin-textMuted">
                          วันอบรม: {it.classInfo?.dateText || "-"} • ห้อง:{" "}
                          {it.classInfo?.roomName || "-"}
                        </div>
                        <div className="mt-1 text-admin-textMuted">
                          วันนี้คือ Day {it.dayIndex || "-"} • ช่องทางรับเอกสาร:{" "}
                          {toLabelReceiveType(it.documentReceiveType)}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {it.documentReceivedAt ? (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              รับเอกสารแล้ว (
                              {formatDateTH(it.documentReceivedAt)})
                            </span>
                          ) : (
                            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                              ยังไม่รับเอกสาร
                            </span>
                          )}

                          {signed ? (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              มีลายเซ็นแล้ว
                            </span>
                          ) : (
                            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                              รอเซ็น
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              // ✅ ยังไม่ค้นหา -> ไม่โชว์กล่อง "ไม่พบ" ให้รก
              hasSearched &&
              !loading && (
                <div className="rounded-2xl border border-admin-border bg-white p-4 text-sm text-admin-textMuted">
                  ไม่พบข้อมูลของวันนี้ (หรือยังไม่มีผู้เช็คอินในวันนี้ /
                  หรือไม่พบเลขเอกสารในระบบ)
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* Step 2 */}
      <div className="mt-4 rounded-2xl border border-admin-border bg-white p-4">
        <div className="text-sm font-semibold text-admin-text">
          Step 2: เซ็นรับเอกสาร
        </div>

        {!selected ? (
          <div className="mt-2 text-sm text-admin-textMuted">
            กรุณาค้นหา แล้วเลือกผู้รับจากผลลัพธ์ก่อน
          </div>
        ) : (
          <>
            <div className="mt-2 text-sm text-admin-textMuted">
              ผู้รับ:{" "}
              <span className="font-medium text-admin-text">
                {selected.name}
              </span>{" "}
              • QT/IV/RP:{" "}
              <span className="font-medium text-admin-text">
                {selected.docIdNormalized || selected.docId}
              </span>
            </div>

            <div className="mt-3 rounded-2xl border border-admin-border bg-admin-surfaceMuted/30 p-3">
              <SignaturePad onChange={setSigDataUrl} />
              <div className="mt-2 text-xs text-admin-textMuted">
                กรุณาเซ็นชื่อในกรอบด้านบน (Undo/ล้างอยู่มุมขวาบน)
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={openConfirmDialog}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-600/90 disabled:opacity-60"
              >
                {saving ? "กำลังบันทึก..." : "ยืนยันการรับเอกสาร"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setSigDataUrl("");
                  setErr("");
                  setItems([]);
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-admin-border bg-white px-4 text-sm font-medium text-admin-text hover:bg-admin-surfaceMuted"
              >
                ยกเลิก
              </button>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 text-xs text-admin-textMuted">
        Notes: หน้านี้จะแสดงเฉพาะ “รอบอบรมวันนี้” และ
        “ผู้ที่เช็คอินแล้วในวันนี้”
      </div>

            {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ยืนยันการรับเอกสาร</DialogTitle>
            <DialogDescription>
              ยืนยันการรับเอกสาร และบันทึกลายเซ็นใช่หรือไม่?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-admin-border bg-white px-4 text-sm font-medium text-admin-text hover:bg-admin-surfaceMuted"
              disabled={saving}
            >
              ยกเลิก
            </button>

            <button
              type="button"
              onClick={doConfirmReceive}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-600/90 disabled:opacity-60"
            >
              {saving ? "กำลังบันทึก..." : "ตกลง"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>บันทึกสำเร็จ</DialogTitle>
            <DialogDescription>
              บันทึกการรับเอกสารเรียบร้อยแล้ว
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                setSuccessOpen(false);
                window.location.reload();
              }}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white hover:bg-brand-primary/90"
            >
              ปิด
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
