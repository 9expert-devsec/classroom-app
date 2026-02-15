"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Eye, X } from "lucide-react";
import SignaturePad from "@/components/shared/SignaturePad";

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

const DEFAULT_ITEMS = { check: false, withholding: false, other: "" };

function docItemsLabel(items) {
  const pieces = [];
  if (items?.check) pieces.push("เช็ค");
  if (items?.withholding) pieces.push("หัก ณ ที่จ่าย");
  if (clean(items?.other)) pieces.push(`อื่นๆ: ${clean(items.other)}`);
  return pieces.length ? pieces.join(" • ") : "-";
}

export default function ReceiveStaffDetailPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const classId = clean(sp.get("classId"));
  const docId = clean(sp.get("docId"));
  const receiverIndex = Number(sp.get("receiverIndex") || 0);

  const [loading, setLoading] = useState(false);
  const [todayYMD, setTodayYMD] = useState("");
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState(null);

  const [docItems, setDocItems] = useState(DEFAULT_ITEMS);
  const [senderSig, setSenderSig] = useState("");
  const [staffSig, setStaffSig] = useState("");
  const [saving, setSaving] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);

  // load by docId via same staff search API, then filter by classId/docId/receiverIndex
  useEffect(() => {
    async function load() {
      setErr("");
      setSelected(null);
      setSenderSig("");
      setStaffSig("");
      setDocItems(DEFAULT_ITEMS);

      if (!classId || !docId) {
        setErr("ลิงก์ไม่ครบ (classId/docId)");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `/api/classroom/receive/staff/search?q=${encodeURIComponent(docId)}`,
          { cache: "no-store" },
        );
        const data = await res.json().catch(() => ({}));
        setTodayYMD(data?.today || "");

        if (!res.ok || data?.ok === false) {
          setErr(data?.error || "โหลดข้อมูลไม่สำเร็จ");
          return;
        }

        const items = Array.isArray(data?.items) ? data.items : [];
        const found = items.find((it) => {
          const itDoc = clean(it.docIdNormalized || it.docId);
          return (
            clean(it.classId) === classId &&
            itDoc === docId &&
            Number(it.receiverIndex || 0) === receiverIndex
          );
        });

        if (!found) {
          setErr("ไม่พบรายการนี้ในวันนี้ (อาจยังไม่ได้เช็คอิน/หรือข้อมูลเปลี่ยน)");
          return;
        }

        // prefill docItems if existed
        setDocItems(
          found?.staffReceiveItems
            ? {
                check: !!found.staffReceiveItems.check,
                withholding: !!found.staffReceiveItems.withholding,
                other: clean(found.staffReceiveItems.other),
              }
            : DEFAULT_ITEMS,
        );

        setSelected(found);
      } catch (e) {
        setErr("เกิดข้อผิดพลาดในการโหลดข้อมูล");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, docId, receiverIndex]);

  const canPreviewOld =
    !!selected?.staffSignedAt &&
    (!!clean(selected?.senderSigUrl) || !!clean(selected?.staffSigUrl));

  function validateBeforeSave() {
    if (!selected) return "กรุณาเลือกผู้ส่งเอกสารก่อน";
    const hasAny =
      !!docItems.check || !!docItems.withholding || !!clean(docItems.other);
    if (!hasAny) return "กรุณาเลือกอย่างน้อย 1 รายการเอกสาร (หรือกรอก 'อื่นๆ')";
    if (!senderSig) return "กรุณาให้ลูกค้าเซ็นชื่อในช่อง 'ลายเซ็นผู้ส่งเอกสาร'";
    if (!staffSig) return "กรุณาให้เจ้าหน้าที่เซ็นชื่อในช่อง 'ลายเซ็นเจ้าหน้าที่รับเอกสาร'";
    return "";
  }

  async function submit() {
    const msg = validateBeforeSave();
    if (msg) {
      setErr(msg);
      return;
    }

    // confirm overwrite if already signed
    const ok = selected?.staffSignedAt
      ? window.confirm(
          `รายการนี้เคยบันทึกแล้วเมื่อ ${formatDateTimeTH(
            selected.staffSignedAt,
          )}\n\nต้องการ "บันทึกทับ/เซ็นใหม่" ใช่หรือไม่?`,
        )
      : window.confirm("ยืนยันการบันทึกการนำส่งเอกสาร (เซ็น 2 ฝ่าย) ใช่หรือไม่?");
    if (!ok) return;

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

      router.replace(
        `/classroom/receive/staff/complete?docId=${encodeURIComponent(
          selected.docIdNormalized || selected.docId || "",
        )}&name=${encodeURIComponent(selected.name || "")}`,
      );
    } catch (e) {
      setErr("เกิดข้อผิดพลาดขณะบันทึก");
    } finally {
      setSaving(false);
    }
  }

  const title = useMemo(() => {
    if (selected?.name) return `นำส่งเอกสาร: ${selected.name}`;
    return "นำส่งเอกสาร";
  }, [selected]);

  return (
    <div className="mx-auto w-full max-w-4xl p-6 h-[100svh] flex flex-col overflow-hidden">
      {/* header */}
      <div className="mb-4 flex items-start gap-3 shrink-0">
        <Link
          href="/classroom/receive/staff"
          className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-admin-border bg-white text-admin-text hover:bg-admin-surfaceMuted"
          aria-label="ย้อนกลับ"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>

        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-wide text-admin-textMuted">
            Sent Doc : detail
          </div>
          <h1 className="mt-1 text-lg font-semibold text-admin-text">{title}</h1>
          <div className="mt-1 text-sm text-admin-textMuted">
            {todayYMD ? `Today: ${todayYMD}` : "ระบบจะแสดงเฉพาะรายการของวันนี้"}
          </div>
        </div>

        {canPreviewOld ? (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="shrink-0 inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-admin-border bg-white px-3 text-xs font-medium text-admin-text hover:bg-admin-surfaceMuted"
            title="ดูบันทึกเดิม"
          >
            <Eye className="h-4 w-4" />
            ดูบันทึกเดิม
          </button>
        ) : null}
      </div>

      {/* card */}
      <div className="rounded-2xl border border-admin-border bg-white p-4 flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* status */}
        <div className="shrink-0">
          {loading ? (
            <div className="text-sm text-admin-textMuted">กำลังโหลดข้อมูล...</div>
          ) : err ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          ) : null}
        </div>

        {/* content scroll */}
        <div className=" flex-1 min-h-0 overflow-y-auto px-1">
          {!loading && !err && !selected ? (
            <div className="text-sm text-admin-textMuted">ไม่พบข้อมูล</div>
          ) : null}

          {!loading && !err && selected ? (
            <>
              {/* Summary */}
              <div className="rounded-2xl bg-admin-surface p-3 text-sm text-admin-text">
                <div className="font-semibold">ข้อมูลผู้ส่งเอกสาร</div>
                <div className="mt-1 text-admin-textMuted">
                  เลขที่เอกสาร:{" "}
                  <span className="font-medium text-admin-text">
                    {selected.docIdNormalized || selected.docId}
                  </span>
                </div>

                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  <div>
                    <span className="text-admin-textMuted">ชื่อ:</span>{" "}
                    <span className="font-medium">{selected.name}</span>
                  </div>
                  <div>
                    <span className="text-admin-textMuted">บริษัท:</span>{" "}
                    <span className="font-medium">{selected.company || "-"}</span>
                  </div>
                </div>

                <div className="mt-3 text-admin-textMuted">
                  Class:{" "}
                  <span className="font-medium text-admin-text">
                    {selected.classInfo?.title || "-"}
                  </span>
                  <div className="mt-1 text-admin-textMuted">
                    วันอบรม: {selected.classInfo?.dateText || "-"} • ห้อง:{" "}
                    {selected.classInfo?.roomName || "-"}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {selected.staffSignedAt ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                      เคยบันทึกแล้ว ({formatDateTimeTH(selected.staffSignedAt)}) •
                      เซ็นใหม่ = บันทึกทับ
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                      ยังไม่บันทึกโหมด 3.2
                    </span>
                  )}

                  {!!selected.staffReceiveItems ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-admin-text ring-1 ring-admin-border">
                      เดิม: {docItemsLabel(selected.staffReceiveItems)}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Doc items */}
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

              {/* Two signatures */}
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-admin-text">
                    ลายเซ็นผู้ส่งเอกสาร (ลูกค้า)
                  </div>
                  <div className="mt-2 rounded-2xl border border-admin-border bg-admin-surfaceMuted/30 p-3">
                    <div className="relative rounded-2xl bg-white h-[220px] sm:h-[260px]">
                      <SignaturePad onChange={setSenderSig} />
                      {/* <div className="pointer-events-none absolute left-4 right-4 bottom-10 border-t border-dashed border-slate-300/70" />
                      <div className="pointer-events-none absolute left-4 bottom-6 text-[11px] text-admin-textMuted">
                        กรุณาเซ็นในกรอบ
                      </div> */}
                    </div>
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
                    <div className="relative rounded-2xl bg-white h-[220px] sm:h-[260px]">
                      <SignaturePad onChange={setStaffSig} />
                      {/* <div className="pointer-events-none absolute left-4 right-4 bottom-10 border-t border-dashed border-slate-300/70" />
                      <div className="pointer-events-none absolute left-4 bottom-6 text-[11px] text-admin-textMuted">
                        กรุณาเซ็นในกรอบ
                      </div> */}
                    </div>
                    <div className="mt-2 text-xs text-admin-textMuted">
                      เจ้าหน้าที่เซ็นชื่อในกรอบนี้
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-admin-textMuted mb-2">
                * ต้องเลือกเอกสารอย่างน้อย 1 รายการ และต้องมีลายเซ็น 2 ฝ่าย
              </div>
            </>
          ) : null}
        </div>

        {/* action bar fixed bottom */}
        <div className="shrink-0 pt-4  bg-white">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => router.push("/classroom/receive/staff")}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-admin-border bg-white px-4 text-sm font-medium text-admin-text hover:bg-admin-surfaceMuted disabled:opacity-60"
              disabled={saving}
            >
              ย้อนกลับ
            </button>

            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-600/90 disabled:opacity-60"
            >
              {saving ? "กำลังบันทึก..." : "ยืนยัน"}
            </button>
          </div>
        </div>
      </div>

      {/* Preview old modal (simple) */}
      {previewOpen && selected ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60"
          onClick={() => setPreviewOpen(false)}
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
                  {selected.name} • {selected.docIdNormalized || selected.docId} •{" "}
                  {selected.staffSignedAt ? formatDateTimeTH(selected.staffSignedAt) : "-"}
                </div>
                {selected.staffReceiveItems ? (
                  <div className="mt-1 text-xs text-admin-textMuted">
                    เอกสาร: {docItemsLabel(selected.staffReceiveItems)}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-admin-border bg-white text-admin-text hover:bg-admin-surfaceMuted"
                aria-label="ปิด"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-admin-border bg-admin-surfaceMuted/30 p-3">
                <div className="text-xs font-semibold text-admin-text">
                  ลายเซ็นผู้ส่งเอกสาร
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
                    <div className="text-xs text-admin-textMuted">- ไม่มีข้อมูล -</div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-admin-border bg-admin-surfaceMuted/30 p-3">
                <div className="text-xs font-semibold text-admin-text">
                  ลายเซ็นเจ้าหน้าที่
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
                    <div className="text-xs text-admin-textMuted">- ไม่มีข้อมูล -</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-admin-border px-4 py-3">
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-xl border border-admin-border bg-white px-4 py-2 text-xs font-medium text-admin-text hover:bg-admin-surfaceMuted"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
