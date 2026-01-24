"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, CheckCircle2, Eye, X } from "lucide-react";
import SignaturePad from "@/components/shared/SignaturePad";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function clean(x) {
  return String(x || "").trim();
}

function formatDateTimeTH(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

const DEFAULT_ITEMS = {
  check: false,
  withholding: false,
  other: "",
};

function docItemsLabel(items) {
  const pieces = [];
  if (items?.check) pieces.push("เช็ค");
  if (items?.withholding) pieces.push("หัก ณ ที่จ่าย");
  if (clean(items?.other)) pieces.push(`อื่นๆ: ${clean(items.other)}`);
  return pieces.length ? pieces.join(" • ") : "-";
}

export default function ReceiveStaffPage() {
  const [step, setStep] = useState("search"); // search | detail | complete
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [todayYMD, setTodayYMD] = useState("");

  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  const [selected, setSelected] = useState(null);

  const [docItems, setDocItems] = useState(DEFAULT_ITEMS);
  const [senderSig, setSenderSig] = useState("");
  const [staffSig, setStaffSig] = useState("");
  const [saving, setSaving] = useState(false);

  const [doneInfo, setDoneInfo] = useState(null);
  const [countdown, setCountdown] = useState(5);

  // ✅ preview modal (ดูบันทึกเดิม)
  const [previewOpen, setPreviewOpen] = useState(false);

  const hintText = useMemo(() => {
    return todayYMD
      ? `ระบบจะแสดงเฉพาะผู้ที่เช็คอินแล้วใน “วันนี้” (${todayYMD}) เพื่อให้ค้นหาเร็ว`
      : "พิมพ์ชื่อ / บริษัท / เลขที่ INV เพื่อค้นหา";
  }, [todayYMD]);

  const hasSearched = useMemo(() => {
    return !!todayYMD || loading || !!err || items.length > 0 || !!selected;
  }, [todayYMD, loading, err, items.length, selected]);

  async function doSearch() {
    const qq = clean(q);

    setErr("");
    setSelected(null);
    setStep("search");
    setSenderSig("");
    setStaffSig("");
    setDocItems(DEFAULT_ITEMS);
    setItems([]); // กันรายการค้าง
    setPreviewOpen(false);

    if (!qq) {
      setErr("กรุณาพิมพ์คำค้นหา (ชื่อ/บริษัท/เลขที่ INV...)");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/classroom/receive/staff/search?q=${encodeURIComponent(qq)}`,
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

  function pickItem(it) {
    setSelected(it);
    setErr("");
    setSenderSig("");
    setStaffSig("");

    setDocItems(
      it?.staffReceiveItems
        ? {
            check: !!it.staffReceiveItems.check,
            withholding: !!it.staffReceiveItems.withholding,
            other: clean(it.staffReceiveItems.other),
          }
        : DEFAULT_ITEMS,
    );

    setStep("detail");
    setPreviewOpen(false);
  }

  function validateBeforeSave() {
    if (!selected) return "กรุณาเลือกผู้ส่งเอกสารก่อน";
    const hasAny =
      !!docItems.check || !!docItems.withholding || !!clean(docItems.other);
    if (!hasAny) return "กรุณาเลือกอย่างน้อย 1 รายการเอกสาร (หรือกรอก 'อื่นๆ')";
    if (!senderSig) return "กรุณาให้ลูกค้าเซ็นชื่อในช่อง 'ลายเซ็นผู้ส่งเอกสาร'";
    if (!staffSig)
      return "กรุณาให้เจ้าหน้าที่เซ็นชื่อในช่อง 'ลายเซ็นเจ้าหน้าที่รับเอกสาร'";
    return "";
  }

  async function confirmStaffReceive() {
    const msg = validateBeforeSave();
    if (msg) {
      setErr(msg);
      return;
    }

    // ✅ ถ้าเคยบันทึกแล้ว -> ถามยืนยันว่าจะทับไหม
    if (selected?.staffSignedAt) {
      const okOverwrite = window.confirm(
        `รายการนี้เคยบันทึกโหมด 3.2 แล้วเมื่อ ${formatDateTimeTH(
          selected.staffSignedAt,
        )}\n\nต้องการ "บันทึกทับ/เซ็นใหม่" ใช่หรือไม่?`,
      );
      if (!okOverwrite) return;
    } else {
      const ok = window.confirm(
        "ยืนยันการบันทึกการนำส่งเอกสาร (เซ็น 2 ฝ่าย) ใช่หรือไม่?",
      );
      if (!ok) return;
    }

    setSaving(true);
    setErr("");

    try {
      const res = await fetch("/api/classroom/receive/staff/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          classId: selected.classId,
          docId: selected.docIdNormalized || selected.docId,
          sender: {
            studentId: selected.studentId,
            name: selected.name,
            company: selected.company,
          },
          staffReceiveItems: {
            check: !!docItems.check,
            withholding: !!docItems.withholding,
            other: clean(docItems.other),
          },
          senderSignatureDataUrl: senderSig,
          staffSignatureDataUrl: staffSig,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        setErr(data?.error || "บันทึกไม่สำเร็จ");
        return;
      }

      setDoneInfo(data?.item || null);
      setStep("complete");
      setCountdown(5);
    } catch (e) {
      setErr("เกิดข้อผิดพลาดขณะบันทึก");
    } finally {
      setSaving(false);
    }
  }

  // complete countdown -> กลับไปหน้า search (ให้คนถัดไปทำต่อ)
  useEffect(() => {
    if (step !== "complete") return;

    const t = setInterval(() => {
      setCountdown((c) => {
        const next = c - 1;
        if (next <= 0) {
          clearInterval(t);
          window.location.href = "/classroom/receive/staff";
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [step]);

  const canPreviewOld =
    !!selected?.staffSignedAt &&
    (!!clean(selected?.senderSigUrl) || !!clean(selected?.staffSigUrl));

  function openPreviewOld() {
    if (!canPreviewOld) return;
    setPreviewOpen(true);
  }

  function closePreviewOld() {
    setPreviewOpen(false);
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-4 flex items-start gap-3">
        <Link
          href="/classroom/receive"
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
            นำส่งเอกสาร (เจ้าหน้าที่รับเอกสารจากลูกค้า)
          </h1>
          <div className="mt-1 text-sm text-admin-textMuted">{hintText}</div>
        </div>
      </div>

      {/* COMPLETE */}
      {step === "complete" ? (
        <div className="rounded-2xl border border-admin-border bg-white p-6">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <div className="text-lg font-semibold text-admin-text">
              นำส่งเอกสารสำเร็จ
            </div>
            <div className="mt-2 text-sm text-admin-textMuted">
              ระบบบันทึกการนำส่งเอกสารเรียบร้อยแล้ว
              {doneInfo?.signedAt ? (
                <div className="mt-1">
                  เวลา: {formatDateTimeTH(doneInfo.signedAt)}
                </div>
              ) : null}
            </div>

            <div className="mt-6 text-sm text-admin-textMuted">
              กลับหน้าค้นหาใน {countdown} วินาที...
            </div>

            <button
              type="button"
              onClick={() =>
                (window.location.href = "/classroom/receive/staff")
              }
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white hover:bg-brand-primary/90"
            >
              กลับหน้ารับเอกสาร
            </button>
          </div>
        </div>
      ) : null}

      {/* SEARCH + RESULTS + DETAIL */}
      {step !== "complete" ? (
        <>
          {/* SEARCH */}
          <div className="rounded-2xl border border-admin-border bg-white p-4">
            <div className="text-sm font-semibold text-admin-text">
              Search: ค้นหาผู้ส่งเอกสาร
            </div>

            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="พิมพ์ชื่อ / บริษัท / เลขที่ INV เช่น INV-001, INV 001"
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
                พบ {items.length} รายการ{" "}
                {todayYMD ? <span>(Today: {todayYMD})</span> : null}
              </div>
            )}

            {err && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            )}
          </div>

          {/* RESULTS */}
          <div className="mt-4">
            {selected ? (
              <div className="rounded-2xl border border-brand-primary bg-brand-primary/5 p-4">
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
                    <span className="font-medium text-admin-text">
                      QT/IV/RP:
                    </span>{" "}
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

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {selected.staffSignedAt ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        เคยบันทึกแล้ว (
                        {formatDateTimeTH(selected.staffSignedAt)})
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                        ยังไม่บันทึกโหมด 3.2
                      </span>
                    )}

                    {!!selected.staffReceiveItems ? (
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-admin-text ring-1 ring-admin-border">
                        {docItemsLabel(selected.staffReceiveItems)}
                      </span>
                    ) : null}
                  </div>

                  {/* ✅ ปุ่มดูบันทึกเดิม */}
                  {canPreviewOld ? (
                    <button
                      type="button"
                      onClick={openPreviewOld}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl border border-admin-border bg-white px-3 py-2 text-xs font-medium text-admin-text hover:bg-admin-surfaceMuted"
                      title="ดูเอกสาร/ลายเซ็นที่เคยบันทึกแล้ว"
                    >
                      <Eye className="h-4 w-4" />
                      ดูบันทึกเดิม
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      setStep("search");
                      setSenderSig("");
                      setStaffSig("");
                      setDocItems(DEFAULT_ITEMS);
                      setErr("");
                      setPreviewOpen(false);
                    }}
                    className="rounded-lg border border-admin-border bg-white px-3 py-1.5 text-xs text-admin-text hover:bg-admin-surfaceMuted"
                  >
                    เลือกคนอื่น
                  </button>
                </div>
              </div>
            ) : (
              <>
                {items.length > 0 ? (
                  <div className="space-y-3">
                    {items.map((it, idx) => (
                      <button
                        key={`${it.studentId}-${it.classId}-${idx}`}
                        type="button"
                        onClick={() => pickItem(it)}
                        className={cx(
                          "w-full text-left rounded-2xl border p-4 transition",
                          "border-admin-border bg-white hover:bg-admin-surfaceMuted/40",
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

                        <div className="mt-3 rounded-2xl bg-admin-surface p-3 text-sm text-admin-text">
                          <div className="font-medium">
                            Class: {it.classInfo?.title || "-"}
                          </div>
                          <div className="mt-1 text-admin-textMuted">
                            วันอบรม: {it.classInfo?.dateText || "-"} • ห้อง:{" "}
                            {it.classInfo?.roomName || "-"}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {it.staffSignedAt ? (
                              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                เคยบันทึกแล้ว (
                                {formatDateTimeTH(it.staffSignedAt)})
                              </span>
                            ) : (
                              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                                ยังไม่บันทึกโหมด 3.2
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  hasSearched &&
                  !loading && (
                    <div className="rounded-2xl border border-admin-border bg-white p-4 text-sm text-admin-textMuted">
                      ไม่พบข้อมูลของวันนี้ (หรือยังไม่มีผู้เช็คอินในวันนี้ /
                      หรือคำค้นหาไม่ตรง)
                    </div>
                  )
                )}
              </>
            )}
          </div>

          {/* DETAIL */}
          <div className="mt-4 rounded-2xl border border-admin-border bg-white p-4">
            <div className="text-sm font-semibold text-admin-text">
              Detail: นำส่งเอกสาร
            </div>

            {!selected ? (
              <div className="mt-2 text-sm text-admin-textMuted">
                กรุณาค้นหา แล้วเลือกผู้ส่งเอกสารจากผลลัพธ์ก่อน
              </div>
            ) : (
              <>
                <div className="mt-3 rounded-2xl bg-admin-surface p-3 text-sm text-admin-text">
                  <div className="font-medium">ข้อมูลผู้ส่งเอกสาร</div>
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    <div>
                      <span className="text-admin-textMuted">ชื่อ:</span>{" "}
                      <span className="font-medium">{selected.name}</span>
                    </div>
                    <div>
                      <span className="text-admin-textMuted">บริษัท:</span>{" "}
                      <span className="font-medium">
                        {selected.company || "-"}
                      </span>
                    </div>
                  </div>

                  {selected.staffSignedAt ? (
                    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      แจ้งเตือน: รายการนี้เคยบันทึกแล้วเมื่อ{" "}
                      {formatDateTimeTH(selected.staffSignedAt)} • หากเซ็นใหม่
                      ระบบจะ “บันทึกทับ” ข้อมูลเดิม
                    </div>
                  ) : null}
                </div>

                <div className="mt-4">
                  <div className="text-sm font-semibold text-admin-text">
                    รายการเอกสารที่นำส่ง
                  </div>

                  <label className="mt-2 flex items-center gap-2 text-sm text-admin-text">
                    <input
                      type="checkbox"
                      checked={!!docItems.check}
                      onChange={(e) =>
                        setDocItems((s) => ({ ...s, check: e.target.checked }))
                      }
                    />
                    เช็ค
                  </label>

                  <label className="mt-2 flex items-center gap-2 text-sm text-admin-text">
                    <input
                      type="checkbox"
                      checked={!!docItems.withholding}
                      onChange={(e) =>
                        setDocItems((s) => ({
                          ...s,
                          withholding: e.target.checked,
                        }))
                      }
                    />
                    เอกสารหัก ณ ที่จ่าย
                  </label>

                  <div className="mt-2">
                    <div className="text-sm text-admin-text">อื่นๆ</div>
                    <input
                      value={docItems.other}
                      onChange={(e) =>
                        setDocItems((s) => ({ ...s, other: e.target.value }))
                      }
                      placeholder="ระบุเพิ่มเติม (ถ้ามี)"
                      className="mt-1 w-full rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-admin-text">
                      ลายเซ็นผู้ส่งเอกสาร (ลูกค้า)
                    </div>
                    <div className="mt-2 rounded-2xl border border-admin-border bg-admin-surfaceMuted/30 p-3">
                      <SignaturePad onChange={setSenderSig} />
                      <div className="mt-2 text-xs text-admin-textMuted">
                        ให้ลูกค้าเซ็นชื่อในกรอบนี้
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-admin-text">
                      ลายเซ็นเจ้าหน้าที่รับเอกสาร
                    </div>
                    <div className="mt-2 rounded-2xl border border-admin-border bg-admin-surfaceMuted/30 p-3">
                      <SignaturePad onChange={setStaffSig} />
                      <div className="mt-2 text-xs text-admin-textMuted">
                        เจ้าหน้าที่เซ็นชื่อในกรอบนี้
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("search");
                      setSelected(null);
                      setSenderSig("");
                      setStaffSig("");
                      setDocItems(DEFAULT_ITEMS);
                      setErr("");
                      setPreviewOpen(false);
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-admin-border bg-white px-4 text-sm font-medium text-admin-text hover:bg-admin-surfaceMuted"
                  >
                    ← ย้อนกลับ
                  </button>

                  <button
                    type="button"
                    onClick={confirmStaffReceive}
                    disabled={saving}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-600/90 disabled:opacity-60"
                  >
                    {saving ? "กำลังบันทึก..." : "ถัดไป"}
                  </button>
                </div>

                <div className="mt-3 text-xs text-admin-textMuted">
                  * ต้องเลือกเอกสารอย่างน้อย 1 รายการ และต้องมีลายเซ็น 2 ฝ่าย
                </div>
              </>
            )}
          </div>

          {/* ✅ Modal: Preview บันทึกเดิม (2 ลายเซ็น) */}
          {previewOpen && selected ? (
            <div
              className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60"
              onClick={closePreviewOld}
            >
              <div
                className="max-h-[85vh] w-[92vw] max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-admin-border px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-admin-text">
                      บันทึกเดิม (โหมด 3.2)
                    </div>
                    <div className="mt-0.5 text-xs text-admin-textMuted">
                      {selected.name} •{" "}
                      {selected.docIdNormalized || selected.docId || "-"} •{" "}
                      {selected.staffSignedAt
                        ? formatDateTimeTH(selected.staffSignedAt)
                        : "-"}
                    </div>
                    {selected.staffReceiveItems ? (
                      <div className="mt-1 text-xs text-admin-textMuted">
                        เอกสาร: {docItemsLabel(selected.staffReceiveItems)}
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={closePreviewOld}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-admin-border bg-white text-admin-text hover:bg-admin-surfaceMuted"
                    aria-label="ปิด"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-4 p-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-admin-border bg-admin-surfaceMuted/30 p-3">
                    <div className="text-xs font-semibold text-admin-text">
                      ลายเซ็นผู้ส่งเอกสาร (ลูกค้า)
                    </div>
                    <div className="mt-2 flex items-center justify-center rounded-xl border border-admin-border bg-white p-3">
                      {!!clean(selected.senderSigUrl) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selected.senderSigUrl}
                          alt="sender signature"
                          className="max-h-[45vh] w-auto max-w-full object-contain"
                        />
                      ) : (
                        <div className="text-xs text-admin-textMuted">
                          - ไม่มีข้อมูล -
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-admin-border bg-admin-surfaceMuted/30 p-3">
                    <div className="text-xs font-semibold text-admin-text">
                      ลายเซ็นเจ้าหน้าที่รับเอกสาร
                    </div>
                    <div className="mt-2 flex items-center justify-center rounded-xl border border-admin-border bg-white p-3">
                      {!!clean(selected.staffSigUrl) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selected.staffSigUrl}
                          alt="staff signature"
                          className="max-h-[45vh] w-auto max-w-full object-contain"
                        />
                      ) : (
                        <div className="text-xs text-admin-textMuted">
                          - ไม่มีข้อมูล -
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-admin-border px-4 py-3">
                  <button
                    type="button"
                    onClick={closePreviewOld}
                    className="rounded-xl border border-admin-border bg-white px-4 py-2 text-xs font-medium text-admin-text hover:bg-admin-surfaceMuted"
                  >
                    ปิด
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
