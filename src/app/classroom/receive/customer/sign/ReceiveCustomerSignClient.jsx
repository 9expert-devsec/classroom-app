"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

export default function ReceiveCustomerSignClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const classId = clean(sp.get("classId"));
  const docId = clean(sp.get("docId"));
  const receiverIndex = Number(sp.get("receiverIndex") || 0);

  const [loading, setLoading] = useState(false);
  const [todayYMD, setTodayYMD] = useState("");
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState(null);

  const [sigDataUrl, setSigDataUrl] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setErr("");
      setSelected(null);
      setSigDataUrl("");

      if (!classId || !docId) {
        setErr("ลิงก์ไม่ครบ (classId/docId)");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `/api/classroom/receive/customer/search?q=${encodeURIComponent(docId)}`,
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

        setSelected(found);
      } catch (e) {
        setErr("เกิดข้อผิดพลาดในการโหลดข้อมูล");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [classId, docId, receiverIndex]);

  function openConfirm() {
    setErr("");
    if (!selected) return;
    if (!sigDataUrl) {
      setErr("กรุณาเซ็นชื่อในกรอบด้านล่าง");
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
        setConfirmOpen(false);
        return;
      }

      router.replace(
        `/classroom/receive/customer/complete?docId=${encodeURIComponent(
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
    if (selected?.name) return `เซ็นรับเอกสาร: ${selected.name}`;
    return "เซ็นรับเอกสาร";
  }, [selected]);

  return (
    <div className="mx-auto w-full max-w-4xl p-6 h-[100svh] flex flex-col overflow-hidden">
      {/* header (ไม่เลื่อน) */}
      <div className="mb-4 flex items-start gap-3 shrink-0">
        <Link
          href="/classroom/receive/customer"
          className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-admin-border bg-white text-admin-text hover:bg-admin-surfaceMuted"
          aria-label="ย้อนกลับ"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>

        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-wide text-admin-textMuted">
            Receive Doc : detail
          </div>
          <h1 className="mt-1 text-lg font-semibold text-admin-text">{title}</h1>
          <div className="mt-1 text-sm text-admin-textMuted">
            {todayYMD ? `Today: ${todayYMD}` : "ระบบจะแสดงเฉพาะรายการของวันนี้"}
          </div>
        </div>
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

        {/* content */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {!loading && !err && !selected ? (
            <div className="text-sm text-admin-textMuted">ไม่พบข้อมูล</div>
          ) : null}

          {!loading && !err && selected ? (
            <>
              {/* Summary */}
              <div className="rounded-2xl bg-admin-surface p-3 text-sm text-admin-text">
                <div className="font-semibold">ข้อมูลเอกสารที่รับ</div>
                <div className="mt-1 text-admin-textMuted">
                  เลขที่เอกสาร:{" "}
                  <span className="font-medium text-admin-text">
                    {selected.docIdNormalized || selected.docId}
                  </span>
                </div>

                <div className="mt-3 font-semibold">ข้อมูลผู้รับเอกสาร</div>
                <div className="mt-1 text-admin-textMuted">
                  ชื่อ:{" "}
                  <span className="font-medium text-admin-text">{selected.name}</span>
                </div>
                <div className="mt-1 text-admin-textMuted">
                  บริษัท:{" "}
                  <span className="font-medium text-admin-text">
                    {selected.company || "-"}
                  </span>
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
                  {selected.documentReceivedAt ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      รับเอกสารแล้ว ({formatDateTH(selected.documentReceivedAt)})
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                      ยังไม่รับเอกสาร
                    </span>
                  )}
                </div>
              </div>

              {/* Signature */}
              <div className="mt-4">
                <div className="text-sm font-semibold text-admin-text">
                  ลายเซ็นยืนยันการรับเอกสาร
                </div>

                <div className="my-2 rounded-2xl border border-admin-border bg-admin-surfaceMuted/30 p-3">
                  <div className="relative rounded-2xl bg-white">
                    <SignaturePad onChange={setSigDataUrl} />
                  </div>

                  <div className="mt-2 text-xs text-admin-textMuted">
                    * ต้องมีลายเซ็นก่อนจึงจะยืนยันได้
                  </div>
                </div>
              </div>

              {err && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {err}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* actions */}
        <div className="shrink-0 pt-4 bg-white">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-admin-textMuted">
              {sigDataUrl ? (
                <span className="font-semibold text-emerald-700">มีลายเซ็นแล้ว</span>
              ) : (
                <span>ยังไม่ได้เซ็น</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/classroom/receive/customer")}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-admin-border bg-white px-4 text-sm font-medium text-admin-text hover:bg-admin-surfaceMuted disabled:opacity-60"
                disabled={saving}
              >
                ย้อนกลับ
              </button>

              <button
                type="button"
                onClick={openConfirm}
                disabled={saving || !sigDataUrl}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-600/90 disabled:opacity-60"
              >
                {saving ? "กำลังบันทึก..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ยืนยันการรับเอกสาร</DialogTitle>
            <DialogDescription>
              คุณกำลังบันทึกรับเอกสารของ <b>{selected?.name || "-"}</b> •{" "}
              <b>{selected?.docIdNormalized || selected?.docId || "-"}</b>
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
    </div>
  );
}
