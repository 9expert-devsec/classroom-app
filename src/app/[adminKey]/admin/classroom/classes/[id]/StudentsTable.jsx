// src/app/admin/classroom/classes/[id]/StudentsTable.jsx
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const BKK_TZ = "Asia/Bangkok";
const EN_LOCALE = "en-GB";

function clean(s) {
  return String(s ?? "").trim();
}

function norm(s) {
  return clean(s).toLowerCase();
}

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

async function safeJson(res) {
  return res?.json?.().catch(() => ({}));
}

function getStudentId(stu) {
  return clean(stu?._id) || clean(stu?.id) || "";
}

function getStudentName(stu) {
  return (
    clean(stu?.name) ||
    clean(stu?.thaiName) ||
    clean(stu?.engName) ||
    clean(stu?.nameTH) ||
    clean(stu?.nameEN) ||
    "-"
  );
}

function getStudentNameEN(stu) {
  return clean(stu?.nameEN) || clean(stu?.engName) || "";
}

function shouldShowENLine(stu) {
  const main = getStudentName(stu);
  const en = getStudentNameEN(stu);
  if (!en) return false;
  if (norm(en) === norm(main)) return false;
  return true;
}

function formatDateTH(input) {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: BKK_TZ,
  });
}

function formatDateTimeTH(input) {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BKK_TZ,
  });
}

function formatTimeTH(input) {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: BKK_TZ,
  });
}

/** -------- day label helpers (EN) -------- */
function ymdFromAnyBKK(value) {
  if (!value) return "";
  const s = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BKK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function ymdToUTCDate(ymd) {
  const s = String(ymd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

function formatDateEN(input) {
  const ymd = ymdFromAnyBKK(input);
  if (!ymd) return "";
  const dt = ymdToUTCDate(ymd);
  if (!dt) return "";
  return dt.toLocaleDateString(EN_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: BKK_TZ,
  });
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function useAutoPageSize({
  viewportRef,
  tableRef,
  min = 5,
  max = 10,
  padding = 8,
  fallbackRowHeight = 64,
}) {
  const [pageSize, setPageSize] = useState(max);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const table = tableRef.current;
    if (!viewport || !table) return;

    const compute = () => {
      const viewportH = viewport.clientHeight || 0;

      const thead = table.querySelector("thead");
      const theadH = thead ? thead.offsetHeight : 0;

      const firstRow = table.querySelector("tbody tr");
      const rowH = firstRow ? firstRow.offsetHeight : fallbackRowHeight;

      const usable = viewportH - theadH - padding;
      const rows = Math.floor(usable / rowH);

      const next = clamp(rows, min, max);
      setPageSize((prev) => (prev === next ? prev : next));
    };

    const raf = requestAnimationFrame(compute);

    const ro = new ResizeObserver(() => compute());
    ro.observe(viewport);
    ro.observe(table);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [viewportRef, tableRef, min, max, padding, fallbackRowHeight]);

  return pageSize;
}

/* ================= Learn Type (Live/Classroom) ================= */

function normalizeLearnType(raw) {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (v === "live") return "live";
  if (v === "classroom") return "classroom";
  return "classroom";
}

function getLearnTypeRaw(stu) {
  return (
    clean(stu?.learnType) ||
    clean(stu?.studyType) ||
    clean(stu?.type) ||
    "classroom"
  );
}

function getLearnTypeEditCount(stu) {
  const n =
    Number(
      stu?.learnTypeEditCount ?? stu?.typeEditCount ?? stu?.typeEdits ?? 0,
    ) || 0;
  return n > 0 ? n : 0;
}

// รองรับ timeline (ถ้ามี) เพื่อให้ “เปลี่ยนประเภทแล้วมีผลตั้งแต่ day นั้นเป็นต้นไป”
function getLearnTypeTimeline(stu) {
  const arr =
    stu?.learnTypeTimeline || stu?.typeTimeline || stu?.learnTypeHistory;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => ({
      effectiveDay: Number(x?.effectiveDay ?? x?.day ?? 1) || 1,
      type: normalizeLearnType(x?.type ?? x?.to ?? x?.learnType ?? "classroom"),
    }))
    .filter((x) => x.effectiveDay >= 1)
    .sort((a, b) => a.effectiveDay - b.effectiveDay);
}

function getLearnTypeForDay(stu, day) {
  const base = normalizeLearnType(getLearnTypeRaw(stu));
  const tl = getLearnTypeTimeline(stu);
  let cur = base;
  for (const it of tl) {
    if (Number(it.effectiveDay) <= Number(day)) cur = it.type;
  }
  return cur;
}

function learnTypeMeta(type) {
  const t = normalizeLearnType(type);
  if (t === "live") {
    return {
      key: "live",
      label: "Live",
      className: "border border-[#464EB8] bg-[#7B83EB] text-white",
    };
  }
  return {
    key: "classroom",
    label: "Classroom",
    className: "border border-[#3AC1F6] bg-[#A0E5FF] text-[#0a1f33]",
  };
}

function getNowBKK() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BKK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(new Date());
  const map = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });

  const ymd = `${map.year}-${map.month}-${map.day}`;
  const hh = Number(map.hour || 0);
  const mm = Number(map.minute || 0);
  return { ymd, minutes: hh * 60 + mm };
}

function getTodayYmdBKK() {
  return ymdFromAnyBKK(new Date());
}

function deriveTodayDayIndex(normalizedDayDates, dayCount) {
  const today = getTodayYmdBKK();
  const arr = Array.isArray(normalizedDayDates) ? normalizedDayDates : [];
  const idx = arr.findIndex((x) => x === today);
  if (idx >= 0) return idx + 1;
  return dayCount >= 1 ? 1 : 1;
}

/* ================= Receive helpers (3.1 customer_receive) ================= */

function ReceiveDocModal({ open, stu, onClose }) {
  if (!open) return null;

  const sig = getReceiveSignatureUrl(stu);
  const receivedAt = getReceivedAt(stu);
  const typeRaw = getReceiveTypeRaw(stu);
  const isEMS = typeRaw === "ems";
  const qtNo = stu?.paymentRef || "-";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-admin-text">
              เอกสาร: รับเอกสาร
            </div>
            <div className="mt-0.5 text-sm text-admin-textMuted">
              {getStudentName(stu)}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-admin-border px-3 py-1 text-xs hover:bg-admin-surfaceMuted"
          >
            ปิด
          </button>
        </div>

        <div className="mt-4 space-y-3 text-base">
          <div className="rounded-xl border border-admin-border p-3 flex flex-col gap-1">
            <div>
              <div className="text-sm text-admin-textMuted">
                เลขที่ QT/IV/RP
              </div>
              <div className="mt-0.5">{qtNo}</div>
            </div>

            <div>
              <div className="text-sm text-admin-textMuted">สถานะ</div>
              <div className="mt-1 font-semibold">
                {isEMS ? (
                  <span className="text-slate-700">
                    รับผ่าน ปณ (ไม่ต้องเซ็น)
                  </span>
                ) : sig ? (
                  <span className="text-emerald-700">รับเอกสารแล้ว</span>
                ) : (
                  <span className="text-zinc-700">ยังไม่รับเอกสาร</span>
                )}
              </div>
            </div>

            <div className=" grid gap-2 sm:grid-cols-2">
              <div>
                <div className="text-sm text-admin-textMuted">
                  ช่องทางรับเอกสาร
                </div>
                <div className="mt-0.5 ">{receiveTypeLabel(typeRaw)}</div>
              </div>

              <div>
                <div className="text-sm text-admin-textMuted">
                  วันที่รับเอกสาร
                </div>
                <div className="mt-0.5">
                  {receivedAt ? formatDateTH(receivedAt) : "-"}
                </div>
              </div>
            </div>
          </div>

          {/* ถ้า EMS ไม่ต้องโชว์ลายเซ็น */}
          {!isEMS && (
            <div className="mt-3 rounded-2xl border border-admin-border bg-white p-4">
              <div className="text-sm text-admin-textMuted">
                ลายเซ็นรับเอกสาร
              </div>

              {sig ? (
                <div className="mt-2 flex items-center justify-center rounded-xl border border-admin-border bg-admin-surfaceMuted/40 ">
                  <img
                    src={sig}
                    alt="ลายเซ็นรับเอกสาร"
                    className="max-h-[240px] w-auto max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="mt-2 flex items-center justify-center rounded-xl border border-dashed border-admin-border bg-admin-surfaceMuted/30 p-6 text-admin-textMuted">
                  ยังไม่มีลายเซ็นรับเอกสาร
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getReceiveTypeRaw(stu) {
  return clean(stu?.documentReceiveType) || clean(stu?.receiveType) || "";
}

function receiveTypeLabel(raw) {
  const x = String(raw || "").trim();
  if (!x) return "-";
  if (x === "on_class" || x === "on_site") return "มารับ ณ วันอบรม";
  if (x === "ems") return "รับผ่าน ปณ";
  return x;
}

function getReceivedAt(stu) {
  return stu?.documentReceivedAt || stu?.receiveDate || null;
}

function getReceiveSignatureUrl(stu) {
  return (
    clean(stu?.documentReceiptSigUrl) ||
    clean(stu?.documentReceiveSigUrl) ||
    clean(stu?.documentSignatureUrl) ||
    clean(stu?.documentSigUrl) ||
    clean(stu?.receiveSignatureUrl) ||
    clean(stu?.receiveSigUrl) ||
    clean(stu?.documentReceiptSig?.url) ||
    clean(stu?.documentReceiveSig?.url) ||
    clean(stu?.receiveSig?.url) ||
    ""
  );
}

/* ================= Staff receive helpers (3.2 staff_receive) ================= */

function StaffDeliverModal({ open, stu, onClose }) {
  if (!open) return null;

  const staffUpdatedAt = getStaffReceiveUpdatedAt(stu);
  const items = getStaffReceiveItems(stu);
  const itemsText = staffItemsLabel(items);

  const customerUrl = getStaffReceiveCustomerSigUrl(stu);
  const staffUrl = getStaffReceiveStaffSigUrl(stu);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-admin-text">
              เอกสาร: เอกสารนำส่ง
            </div>
            <div className="mt-0.5 text-sm text-admin-textMuted">
              {getStudentName(stu)}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-admin-border px-3 py-1 text-xs hover:bg-admin-surfaceMuted"
          >
            ปิด
          </button>
        </div>

        <div className="mt-4 space-y-3 text-xs">
          <div className="rounded-xl border border-admin-border p-3">
            <div className="text-sm text-admin-textMuted">สถานะ</div>
            <div className="mt-1 text-base font-semibold text-blue-700">
              นำส่งเอกสารแล้ว
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <div className="text-sm text-admin-textMuted">บันทึกเมื่อ</div>
                <div className="mt-0.5 text-base">
                  {staffUpdatedAt ? formatDateTimeTH(staffUpdatedAt) : "-"}
                </div>
              </div>
              <div>
                <div className="text-sm text-admin-textMuted">รายการ</div>
                <div className="mt-0.5 text-base">{itemsText || "-"}</div>
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-admin-border bg-white p-4">
              <div className="text-sm text-admin-textMuted">
                ลายเซ็นผู้ส่งเอกสาร (ลูกค้า)
              </div>
              {customerUrl ? (
                <div className="mt-2 flex items-center justify-center rounded-xl border border-admin-border bg-admin-surfaceMuted/40">
                  <img
                    src={customerUrl}
                    alt="ลายเซ็นลูกค้า"
                    className="max-h-[220px] w-auto max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="mt-2 flex items-center justify-center rounded-xl border border-dashed border-admin-border bg-admin-surfaceMuted/30 p-6 text-xs text-admin-textMuted">
                  ไม่มีลายเซ็นลูกค้า
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-admin-border bg-white p-4">
              <div className="text-sm text-admin-textMuted">
                ลายเซ็นเจ้าหน้าที่รับเอกสาร
              </div>
              {staffUrl ? (
                <div className="mt-2 flex items-center justify-center rounded-xl border border-admin-border bg-admin-surfaceMuted/40">
                  <img
                    src={staffUrl}
                    alt="ลายเซ็นเจ้าหน้าที่"
                    className="max-h-[220px] w-auto max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="mt-2 flex items-center justify-center rounded-xl border border-dashed border-admin-border bg-admin-surfaceMuted/30 p-6 text-sm text-admin-textMuted">
                  ไม่มีลายเซ็นเจ้าหน้าที่
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStaffReceiveUpdatedAt(stu) {
  return (
    stu?.staffReceiveUpdatedAt ||
    stu?.staffReceiveStaffSignedAt ||
    stu?.staffReceiveCustomerSignedAt ||
    null
  );
}

function getStaffReceiveCustomerSigUrl(stu) {
  return (
    clean(stu?.staffReceiveCustomerSigUrl) ||
    clean(stu?.staffReceiveCustomerSig?.url) ||
    clean(stu?.staffReceiveCustomerSig?.receiptSig?.url) ||
    ""
  );
}

function getStaffReceiveStaffSigUrl(stu) {
  return (
    clean(stu?.staffReceiveStaffSigUrl) ||
    clean(stu?.staffReceiveStaffSig?.url) ||
    ""
  );
}

function getStaffReceiveItems(stu) {
  const it = stu?.staffReceiveItems || null;
  if (!it) return null;
  return {
    check: !!it.check,
    withholding: !!it.withholding,
    other: clean(it.other),
  };
}

function staffItemsLabel(items) {
  if (!items) return "";
  const parts = [];
  if (items.check) parts.push("เช็ค");
  if (items.withholding) parts.push("หัก ณ ที่จ่าย");
  if (items.other) parts.push(`อื่นๆ: ${items.other}`);
  return parts.join(" • ");
}

/* ================= Check-in helpers (รองรับหลาย shape) ================= */

function getCheckinInfo(stu, day) {
  const key = `day${day}`;
  const byNum = stu?.checkins?.[day];
  const byStrNum = stu?.checkins?.[String(day)];
  const byDayKey = stu?.checkins?.[key];

  if (Array.isArray(stu?.checkinDaily)) {
    const found = stu.checkinDaily.find((x) => Number(x.day) === Number(day));
    if (found) {
      return {
        signatureUrl: found.signatureUrl,
        time: found.time,
        isLate: found.isLate,
        mode: found.mode || found.kind || "",
        status: found.status || "",
        checkedIn: !!found.checkedIn,
      };
    }
  }
  return byNum || byStrNum || byDayKey || null;
}

function getCheckinChecked(stu, day) {
  if (Array.isArray(stu?.checkinDaily)) {
    const found = stu.checkinDaily.find((x) => Number(x.day) === Number(day));
    return Boolean(found?.checkedIn);
  }
  const key = `day${day}`;
  return Boolean(stu?.checkin?.[key] ?? stu?.checkinStatus?.[key] ?? false);
}

function getCheckinSignatureUrl(stu, day) {
  const info = getCheckinInfo(stu, day);
  // ✅ ถ้าวันนั้นไม่ได้เช็คอิน ห้ามโชว์ลายเซ็นเด็ดขาด
  if (!info || !info.checkedIn) return "";
  // ✅ วันนั้นเช็คอินแล้วค่อยโชว์ (ถ้าคุณยังอยากมี fallback legacy)
  return clean(info?.signatureUrl) || clean(stu?.signatureUrl) || "";
}

function getCheckinTimeRaw(stu, day) {
  const key = `day${day}`;
  const info = getCheckinInfo(stu, day);
  return stu?.checkinTimes?.[key] || info?.time || null;
}

function getIsLateForDay(stu, day) {
  const info = getCheckinInfo(stu, day);
  return Boolean(info?.isLate ?? stu?.isLate ?? stu?.late ?? false);
}

function getAttendanceMode(stu, day) {
  const info = getCheckinInfo(stu, day);
  const mode = clean(info?.mode);
  const status = clean(info?.status);
  return { mode, status };
}

/* ================= Student status (active/cancelled/postponed) ================= */

function getStudentStatusRaw(stu) {
  return clean(stu?.studentStatus) || clean(stu?.status) || "active";
}

function studentStatusMeta(raw) {
  const s = String(raw || "active").trim();
  if (s === "cancelled") {
    return {
      key: "cancelled",
      label: "ยกเลิก",
      className: "border border-zinc-200 bg-zinc-100 text-zinc-700",
    };
  }
  if (s === "postponed") {
    return {
      key: "postponed",
      label: "เลื่อนวันเรียน",
      className: "border border-purple-200 bg-purple-50 text-purple-700",
    };
  }
  return {
    key: "active",
    label: "ผู้เรียน",
    className: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

/* ================= Logs / Signature delete UI ================= */

function LogsModal({ open, stu, onClose }) {
  if (!open) return null;

  const logs = Array.isArray(stu?.editLogs) ? stu.editLogs : [];

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-admin-text">
              ประวัติการแก้ไข
            </div>
            <div className="mt-0.5 text-sm text-admin-textMuted">
              {getStudentName(stu)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-admin-border px-3 py-1 text-xs hover:bg-admin-surfaceMuted"
          >
            ปิด
          </button>
        </div>

        <div className="mt-4">
          {logs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-admin-border p-6 text-sm text-admin-textMuted">
              ยังไม่มี log (ต้องเริ่มเขียนจาก API ตอน PATCH/DELETE)
            </div>
          ) : (
            <div className="space-y-2">
              {logs
                .slice()
                .reverse()
                .map((it, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-admin-border p-3 text-sm"
                  >
                    <div className="text-xs text-admin-textMuted">
                      {it?.at ? formatDateTimeTH(it.at) : "-"}{" "}
                      {it?.by ? `• โดย ${it.by}` : ""}
                      {it?.field ? ` • field: ${it.field}` : ""}
                    </div>
                    <div className="mt-1">
                      {it?.action ? (
                        <span className="font-semibold">{it.action}</span>
                      ) : (
                        <span className="font-semibold">แก้ไข</span>
                      )}
                      {typeof it?.from !== "undefined" ||
                      typeof it?.to !== "undefined" ? (
                        <span className="ml-2 text-admin-textMuted">
                          {`"${clean(it.from)}" → "${clean(it.to)}"`}
                        </span>
                      ) : null}
                    </div>
                    {it?.note ? (
                      <div className="mt-1 text-xs text-admin-textMuted">
                        note: {it.note}
                      </div>
                    ) : null}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SignatureDeleteModal({
  open,
  stu,
  days,
  classId,
  onClose,
  onDeleted,
}) {
  if (!open) return null;

  const stuId = getStudentId(stu);

  async function del(payload) {
    if (!classId || !stuId) return;
    const ok = window.confirm("ยืนยันลบลายเซ็นนี้?");
    if (!ok) return;

    try {
      const res = await fetch(
        `/api/admin/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(stuId)}/signatures`,
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await safeJson(res);
      if (!res.ok || data?.ok === false) {
        alert(data?.error || "ลบไม่สำเร็จ (ต้องทำ API ต่อ)");
        return;
      }
      alert("ลบเรียบร้อย");
      onDeleted?.();
    } catch (e) {
      console.error(e);
      alert("ลบไม่สำเร็จ");
    }
  }

  const receiveType = getReceiveTypeRaw(stu);
  const isEMS = receiveType === "ems";

  const receiveSig = getReceiveSignatureUrl(stu);
  const staffCus = getStaffReceiveCustomerSigUrl(stu);
  const staffStaff = getStaffReceiveStaffSigUrl(stu);

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-admin-text">
              ลบลายเซ็น
            </div>
            <div className="mt-0.5 text-sm text-admin-textMuted">
              {getStudentName(stu)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-admin-border px-3 py-1 text-xs hover:bg-admin-surfaceMuted"
          >
            ปิด
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-xl border border-admin-border p-3">
            <div className="font-semibold">ลายเซ็นเช็คอิน</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {days.map((d) => {
                const url = getCheckinSignatureUrl(stu, d);
                if (!url) return null;
                return (
                  <div
                    key={`sig-day-${d}`}
                    className="rounded-xl border border-admin-border p-2"
                  >
                    <div className="text-xs text-admin-textMuted">Day {d}</div>
                    <div className="mt-1 flex items-center justify-center rounded-lg bg-admin-surfaceMuted/40 p-2">
                      <img
                        src={url}
                        alt={`sig day ${d}`}
                        className="max-h-[120px] w-auto max-w-full object-contain"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => del({ kind: "checkin", day: d })}
                      className="mt-2 w-full rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      ลบลายเซ็น Day {d}
                    </button>
                  </div>
                );
              })}
              {days.every((d) => !getCheckinSignatureUrl(stu, d)) ? (
                <div className="text-xs text-admin-textMuted">
                  ไม่มีลายเซ็นเช็คอินให้ลบ
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-admin-border p-3">
            <div className="font-semibold">รับเอกสาร (3.1)</div>
            {isEMS ? (
              <div className="mt-2 text-xs text-admin-textMuted">
                กรณี EMS ไม่ต้องมีลายเซ็น
              </div>
            ) : receiveSig ? (
              <button
                type="button"
                onClick={() => del({ kind: "receive_3_1" })}
                className="mt-2 rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                ลบลายเซ็นรับเอกสาร (3.1)
              </button>
            ) : (
              <div className="mt-2 text-xs text-admin-textMuted">
                ไม่มีลายเซ็นรับเอกสาร
              </div>
            )}
          </div>

          <div className="rounded-xl border border-admin-border p-3">
            <div className="font-semibold">เอกสารนำส่ง (3.2)</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {staffCus ? (
                <button
                  type="button"
                  onClick={() => del({ kind: "staff_3_2", who: "customer" })}
                  className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  ลบลายเซ็นลูกค้า (3.2)
                </button>
              ) : (
                <span className="text-xs text-admin-textMuted">
                  ไม่มีลายเซ็นลูกค้า
                </span>
              )}

              {staffStaff ? (
                <button
                  type="button"
                  onClick={() => del({ kind: "staff_3_2", who: "staff" })}
                  className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  ลบลายเซ็นเจ้าหน้าที่ (3.2)
                </button>
              ) : (
                <span className="text-xs text-admin-textMuted">
                  ไม่มีลายเซ็นเจ้าหน้าที่
                </span>
              )}
            </div>
          </div>

          <div className="text-[11px] text-admin-textMuted">
            * เมนูนี้ทำ UI ให้ก่อน — ต้องทำ API ลบจริง (รวมลบไฟล์บน Cloudinary
            ถ้ามี publicId)
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= Filter helpers ================= */

function deriveDefaultFilterDay(normalizedDayDates, dayCount) {
  const daysLen = normalizedDayDates?.length || 0;
  const n = daysLen || Number(dayCount || 0) || 1;
  const today = getTodayYmdBKK();
  if (daysLen) {
    const idx = normalizedDayDates.findIndex((x) => x === today);
    if (idx >= 0) return idx + 1;
  }
  return 1 <= n ? 1 : 1;
}

export default function StudentsTable({
  students,
  dayCount,
  dayDates = [], // ✅ NEW
  classId = "",
  selectedIds,
  onSelectedIdsChange,
  onReloadRequested,
}) {
  const [preview, setPreview] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState("");
  const [overridesById, setOverridesById] = useState({});

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editDeleting, setEditDeleting] = useState(false);
  const [editStuId, setEditStuId] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    nameEN: "",
    company: "",
    paymentRef: "",
    studentStatus: "active",
    documentReceiveType: "ems",
    learnType: "classroom",
  });

  const viewportRef = useRef(null);
  const tableRef = useRef(null);

  useAutoPageSize({
    viewportRef,
    tableRef,
    min: 2,
    max: 10,
    fallbackRowHeight: 64,
    padding: 8,
  });

  const normalizedDayDates = useMemo(() => {
    const arr = Array.isArray(dayDates) ? dayDates : [];
    return arr.map((x) => ymdFromAnyBKK(x)).filter(Boolean);
  }, [dayDates]);

  const days = useMemo(() => {
    const n = normalizedDayDates.length || dayCount || 1;
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [dayCount, normalizedDayDates]);

  const getDayLabel = useMemo(() => {
    return (d) => {
      const ymd = normalizedDayDates?.[Number(d) - 1];
      return ymd ? formatDateEN(ymd) : `DAY ${d}`;
    };
  }, [normalizedDayDates]);

  // tick เวลาเพื่อแสดง LIVE CHECK/ไม่เข้าเรียน แบบ realtime
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30 * 1000);
    return () => clearInterval(t);
  }, []);
  const nowBKK = useMemo(() => getNowBKK(), [nowTick]);

  const [internalSelected, setInternalSelected] = useState([]);
  const isControlled = Array.isArray(selectedIds);
  const sel = isControlled ? selectedIds : internalSelected;

  function setSel(next) {
    if (isControlled) {
      onSelectedIdsChange?.(next);
    } else {
      setInternalSelected(next);
      onSelectedIdsChange?.(next);
    }
  }

  function toggleSelect(id) {
    if (!id) return;
    setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  }

  function isAllVisibleSelected(visibleIds) {
    if (!visibleIds.length) return false;
    return visibleIds.every((id) => sel.includes(id));
  }

  function toggleSelectAllVisible(visibleIds) {
    if (!visibleIds.length) return;
    const allSelected = isAllVisibleSelected(visibleIds);
    if (allSelected) {
      setSel(sel.filter((id) => !visibleIds.includes(id)));
    } else {
      const next = new Set(sel);
      visibleIds.forEach((id) => next.add(id));
      setSel(Array.from(next));
    }
  }

  const mergedStudents = useMemo(() => {
    const list = Array.isArray(students) ? students : [];
    if (!list.length) return [];
    return list.map((s) => {
      const id = getStudentId(s);
      const ov = id ? overridesById[id] : null;
      return ov ? { ...s, ...ov } : s;
    });
  }, [students, overridesById]);

  /* ================= Filters ================= */

  const [filterKey, setFilterKey] = useState("all"); // all | checkedin | notchecked | late | cancelled | postponed
  const [filterDay, setFilterDay] = useState(() =>
    deriveDefaultFilterDay(normalizedDayDates, dayCount),
  );

  useEffect(() => {
    const n = days.length || 1;
    setFilterDay((prev) => {
      const p = Number(prev || 1);
      if (Number.isFinite(p) && p >= 1 && p <= n) return p;
      return deriveDefaultFilterDay(normalizedDayDates, dayCount);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedDayDates, dayCount, days.length]);

  const filteredStudents = useMemo(() => {
    const list = mergedStudents;
    if (!list.length) return [];

    return list.filter((stu) => {
      const statusRaw = getStudentStatusRaw(stu);
      const isActive = statusRaw === "active";

      if (filterKey === "cancelled") return statusRaw === "cancelled";
      if (filterKey === "postponed") return statusRaw === "postponed";

      if (filterKey === "checkedin") {
        if (!isActive) return false;
        return getCheckinChecked(stu, filterDay);
      }
      if (filterKey === "notchecked") {
        if (!isActive) return false;
        return !getCheckinChecked(stu, filterDay);
      }
      if (filterKey === "late") {
        if (!isActive) return false;
        return (
          getCheckinChecked(stu, filterDay) && getIsLateForDay(stu, filterDay)
        );
      }

      return true;
    });
  }, [mergedStudents, filterKey, filterDay]);

  const visible = filteredStudents;

  const visibleIds = useMemo(() => {
    return visible.map((s) => getStudentId(s)).filter(Boolean);
  }, [visible]);

  function openCheckinPreview(stu, day) {
    const url = getCheckinSignatureUrl(stu, day);
    if (!url) return;

    const timeLabel = formatTimeTH(getCheckinTimeRaw(stu, day)) || "";
    const isLate = getIsLateForDay(stu, day);

    setPreview({
      url,
      title: "ลายเซ็นเช็กอิน",
      subtitle: `${getStudentName(stu)} • ${getDayLabel(day)}${
        timeLabel ? ` • เวลา ${timeLabel} น.` : ""
      }${isLate ? " • สาย" : " • ตรงเวลา"}`,
    });
  }

  function closePreview() {
    setPreview(null);
  }

  function openEdit(stu) {
    const id = getStudentId(stu);
    if (!id) return;

    setEditStuId(id);
    setMenuOpenId("");

    setEditForm({
      name:
        clean(stu?.name) || clean(stu?.thaiName) || clean(stu?.nameTH) || "",
      nameEN: clean(stu?.nameEN) || clean(stu?.engName) || "",
      company: clean(stu?.company) || "",
      paymentRef: clean(stu?.paymentRef) || "",
      studentStatus: studentStatusMeta(getStudentStatusRaw(stu)).key,
      documentReceiveType: clean(stu?.documentReceiveType) || "ems",
      learnType: normalizeLearnType(getLearnTypeRaw(stu)),
    });

    setEditOpen(true);
  }

  function closeEdit() {
    if (editSaving || editDeleting) return;
    setEditOpen(false);
  }

  async function saveEdit(e) {
    e?.preventDefault?.();
    if (!classId || !editStuId) {
      alert("ไม่พบ classId/studentId สำหรับบันทึก");
      return;
    }

    const ok = window.confirm("ยืนยันบันทึกการแก้ไขนักเรียนรายนี้หรือไม่?");
    if (!ok) return;

    const effectiveDay = deriveTodayDayIndex(normalizedDayDates, dayCount);

    setEditSaving(true);
    try {
      const payload = {
        name: clean(editForm.name),
        nameEN: clean(editForm.nameEN),
        engName: clean(editForm.nameEN),
        company: clean(editForm.company),
        paymentRef: clean(editForm.paymentRef),
        documentReceiveType: clean(editForm.documentReceiveType) || "ems",
        studentStatus: clean(editForm.studentStatus) || "active",

        // ✅ ประเภท
        learnType: normalizeLearnType(editForm.learnType),
        learnTypeEffectiveDay: effectiveDay, // ให้ API ใช้เป็น “มีผลตั้งแต่ day นี้”
      };

      const res = await fetch(
        `/api/admin/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(editStuId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = await safeJson(res);
      if (!res.ok || data?.ok === false) {
        console.error("update student failed", data);
        alert(data?.error || "บันทึกไม่สำเร็จ");
        return;
      }

      const fromRes = data?.student || null;
      setOverridesById((m) => ({
        ...m,
        [editStuId]: {
          name: payload.name,
          nameEN: payload.nameEN,
          engName: payload.engName,
          company: payload.company,
          paymentRef: payload.paymentRef,
          documentReceiveType: payload.documentReceiveType,
          studentStatus: fromRes?.studentStatus || payload.studentStatus,
          learnType: fromRes?.learnType || payload.learnType,
          learnTypeEditCount: fromRes?.learnTypeEditCount,
          learnTypeTimeline: fromRes?.learnTypeTimeline,
          editLogs: fromRes?.editLogs,
        },
      }));

      alert("บันทึกเรียบร้อย");
      setEditOpen(false);
      onReloadRequested?.();
    } catch (err) {
      console.error("update student error", err);
      alert("เกิดข้อผิดพลาดระหว่างบันทึก");
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteStudent() {
    if (!classId || !editStuId) {
      alert("ไม่พบ classId/studentId สำหรับลบ");
      return;
    }

    const ok = window.confirm(
      "ยืนยันลบผู้เรียนรายนี้ออกจาก Class?\n\n(ข้อมูลเช็กอิน/รับเอกสารของคนนี้จะหายตามการออกแบบระบบ)",
    );
    if (!ok) return;

    setEditDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(editStuId)}`,
        { method: "DELETE" },
      );
      const data = await safeJson(res);
      if (!res.ok || data?.ok === false) {
        console.error("delete student failed", data);
        alert(data?.error || "ลบไม่สำเร็จ");
        return;
      }

      alert("ลบเรียบร้อย");
      setSel(sel.filter((x) => x !== editStuId));
      setOverridesById((m) => {
        const next = { ...m };
        delete next[editStuId];
        return next;
      });
      setEditOpen(false);
      onReloadRequested?.();
    } catch (err) {
      console.error("delete student error", err);
      alert("เกิดข้อผิดพลาดระหว่างลบ");
    } finally {
      setEditDeleting(false);
    }
  }

  const TH_BASE = "box-border px-3 py-2";
  const TD_BASE = "box-border px-3 py-2";
  const stickyTopHead = "sticky top-0 z-30 ";
  const stickyLeft =
    "sticky left-0 z-10 bg-white group-hover/row:bg-admin-surfaceMuted";
  const stickyLeftHead = "sticky left-0 z-50 bg-[#0a1f33] text-white";
  const stickyRight =
    "sticky right-0 z-10 bg-white group-hover/row:bg-admin-surfaceMuted";
  const stickyRightHead = "sticky right-0 z-50 bg-[#0a1f33] text-white";

  const [menuOpen, setMenuOpen] = useState(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onScroll = () => {
      setMenuOpen(null);
      setMenuOpenId("");
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const [receiveModal, setReceiveModal] = useState({ open: false, stu: null });
  const [staffModal, setStaffModal] = useState({ open: false, stu: null });
  const [logsModal, setLogsModal] = useState({ open: false, stu: null });
  const [sigModal, setSigModal] = useState({ open: false, stu: null });

  function openReceiveModal(stu) {
    setReceiveModal({ open: true, stu });
  }
  function closeReceiveModal() {
    setReceiveModal({ open: false, stu: null });
  }

  function openStaffModal(stu) {
    setStaffModal({ open: true, stu });
  }
  function closeStaffModal() {
    setStaffModal({ open: false, stu: null });
  }

  function openLogs(stu) {
    setLogsModal({ open: true, stu });
  }
  function closeLogs() {
    setLogsModal({ open: false, stu: null });
  }

  function openSigTools(stu) {
    setSigModal({ open: true, stu });
  }
  function closeSigTools() {
    setSigModal({ open: false, stu: null });
  }

  const filterLabel = useMemo(() => {
    if (filterKey === "checkedin") return "เช็คอินแล้ว";
    if (filterKey === "notchecked") return "ยังไม่เช็คอิน";
    if (filterKey === "late") return "เช็คอินสาย";
    if (filterKey === "cancelled") return "ยกเลิก";
    if (filterKey === "postponed") return "ขอเลื่อน";
    return "All";
  }, [filterKey]);

  return (
    <>
      {/* ===== Toolbar (Filter + Day + Selection) ===== */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-admin-textMuted">Filter:</div>

          <select
            value={filterKey}
            onChange={(e) => setFilterKey(e.target.value)}
            className="h-8 rounded-lg border border-admin-border bg-white px-2 text-xs text-admin-text"
          >
            <option value="all">All</option>
            <option value="checkedin">เช็คอิน</option>
            <option value="notchecked">ยังไม่เช็ค</option>
            <option value="late">เช็คสาย</option>
            <option value="cancelled">ยกเลิก</option>
            <option value="postponed">ขอเลื่อน</option>
          </select>

          {days.length > 1 &&
            (filterKey === "checkedin" ||
              filterKey === "notchecked" ||
              filterKey === "late") && (
              <>
                <div className="ml-1 text-xs text-admin-textMuted">Day:</div>
                <select
                  value={String(filterDay)}
                  onChange={(e) => setFilterDay(Number(e.target.value || 1))}
                  className="h-8 rounded-lg border border-admin-border bg-white px-2 text-xs text-admin-text"
                >
                  {days.map((d) => (
                    <option key={`fday-${d}`} value={String(d)}>
                      {getDayLabel(d)}
                    </option>
                  ))}
                </select>
              </>
            )}

          <div className="ml-1 text-xs text-admin-textMuted">
            แสดง:{" "}
            <span className="font-semibold text-admin-text">
              {visible.length}
            </span>{" "}
            คน ({filterLabel})
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-admin-textMuted">
            เลือกแล้ว:{" "}
            <span className="font-semibold text-admin-text">{sel.length}</span>{" "}
            คน
          </div>

          {sel.length > 0 && (
            <button
              type="button"
              onClick={() => setSel([])}
              className="h-8 rounded-lg border border-admin-border bg-white px-3 text-xs text-admin-text hover:bg-admin-surfaceMuted"
            >
              ล้างที่เลือก
            </button>
          )}
        </div>
      </div>

      <div
        ref={viewportRef}
        className="min-h-0 flex-1 overflow-auto rounded-xl"
      >
        <table
          ref={tableRef}
          className="min-w-full w-max table-fixed border-separate border-spacing-0 text-xs sm:text-sm"
        >
          <colgroup>
            <col className="w-[50px]" />
            <col className="w-[150px]" />
            <col className="w-[160px]" />
            <col className="w-[130px]" />
            <col className="w-[110px]" /> {/* ✅ ประเภท */}
            <col className="w-[100px]" />
            <col className="w-[150px]" />
            {days.map((d) => (
              <col key={`col-day-${d}`} className="w-[150px]" />
            ))}
            <col className="w-[80px]" />
          </colgroup>

          <thead className=" text-[#0a1f33] uppercase text-[11px]">
            <tr>
              <th
                className={cx(TH_BASE, stickyTopHead, stickyLeftHead, "left-0")}
              >
                <input
                  type="checkbox"
                  checked={isAllVisibleSelected(visibleIds)}
                  onChange={() => toggleSelectAllVisible(visibleIds)}
                  aria-label="เลือกทั้งหมดในหน้านี้"
                  className="h-4 w-4 accent-brand-primary"
                />
              </th>

              <th
                className={cx(
                  TH_BASE,
                  "text-left",
                  stickyTopHead,
                  stickyLeftHead,
                  "left-[50px]",
                )}
              >
                ชื่อ - สกุล
              </th>

              <th
                className={cx(
                  TH_BASE,
                  "text-left",
                  stickyTopHead,
                  stickyLeftHead,
                  "left-[200px]",
                )}
              >
                บริษัท
              </th>

              <th
                className={cx(
                  TH_BASE,
                  "text-left",
                  stickyTopHead,
                  stickyLeftHead,
                  "left-[360px]",
                )}
              >
                เลขที่ QT/IV/RP
              </th>

              {/* ✅ NEW: ประเภท */}
              <th
                className={cx(
                  TH_BASE,
                  "text-center",
                  stickyTopHead,
                  stickyLeftHead,
                  "left-[490px]",
                )}
              >
                ประเภท
              </th>

              <th
                className={cx(
                  TH_BASE,
                  "text-center",
                  stickyTopHead,
                  stickyLeftHead,
                  "left-[600px]",
                )}
              >
                สถานะ
              </th>

              <th
                className={cx(
                  TH_BASE,
                  "text-center",
                  stickyTopHead,
                  stickyLeftHead,
                  "left-[700px]",
                  "shadow-[2px_0_0_0_rgba(0,0,0,0.06)]",
                )}
              >
                เอกสาร
              </th>

              {days.map((d) => (
                <th
                  key={d}
                  className={cx(
                    TH_BASE,
                    "text-center bg-brand-primary",
                    stickyTopHead,
                  )}
                  title={`Day ${d}`}
                >
                  {getDayLabel(d)}
                </th>
              ))}

              <th
                className={cx(
                  TH_BASE,
                  "text-center",
                  stickyTopHead,
                  stickyRightHead,
                  "right-0",
                  "shadow-[-2px_0_0_0_rgba(0,0,0,0.06)]",
                )}
              >
                จัดการ
              </th>
            </tr>
          </thead>

          <tbody>
            {visible.map((stu, i) => {
              const displayName = getStudentName(stu);
              const stuId = getStudentId(stu);
              const checkedRow = !!stuId && sel.includes(stuId);

              const receiveType = getReceiveTypeRaw(stu);
              const isEMS = receiveType === "ems";
              const receiveSigUrl = getReceiveSignatureUrl(stu);

              const staffUpdatedAt = getStaffReceiveUpdatedAt(stu);
              const staffCustomerUrl = getStaffReceiveCustomerSigUrl(stu);
              const staffStaffUrl = getStaffReceiveStaffSigUrl(stu);
              const staffDone = !!(
                staffCustomerUrl ||
                staffStaffUrl ||
                staffUpdatedAt
              );

              const st = studentStatusMeta(getStudentStatusRaw(stu));

              // type (current)
              const typeNow = normalizeLearnType(getLearnTypeRaw(stu));
              const tm = learnTypeMeta(typeNow);
              const editCount = getLearnTypeEditCount(stu);

              return (
                <tr
                  key={stuId || i}
                  className={cx(
                    "group/row h-16 border-t border-admin-border",
                    checkedRow ? "bg-brand-primary/5" : "",
                  )}
                >
                  <td
                    className={cx(TD_BASE, "text-center", stickyLeft, "left-0")}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-primary"
                      checked={checkedRow}
                      onChange={() => toggleSelect(stuId)}
                      disabled={!stuId}
                      aria-label={`เลือก ${displayName}`}
                    />
                  </td>

                  <td className={cx(TD_BASE, stickyLeft, "left-[50px]")}>
                    {displayName}
                    {shouldShowENLine(stu) && (
                      <div className="text-[11px] text-admin-textMuted">
                        {getStudentNameEN(stu)}
                      </div>
                    )}
                  </td>

                  <td
                    className={cx(
                      TD_BASE,
                      "whitespace-normal break-all text-admin-textMuted text-wrap",
                      stickyLeft,
                      "left-[200px]",
                    )}
                  >
                    {stu.company || "-"}
                  </td>

                  <td
                    className={cx(
                      TD_BASE,
                      "text-admin-textMuted",
                      stickyLeft,
                      "left-[360px]",
                    )}
                  >
                    {stu.paymentRef || "-"}
                  </td>

                  {/* ✅ ประเภท */}
                  <td
                    className={cx(
                      TD_BASE,
                      "text-center",
                      stickyLeft,
                      "left-[490px]",
                    )}
                  >
                    <span
                      className={cx(
                        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold",
                        tm.className,
                      )}
                      title={`learnType: ${tm.key}`}
                    >
                      {editCount > 0 && (
                        <span className="mr-1 text-[10px] font-bold opacity-90">
                          {editCount}e
                        </span>
                      )}
                      {tm.label}
                    </span>
                  </td>

                  <td
                    className={cx(
                      TD_BASE,
                      "text-center",
                      stickyLeft,
                      "left-[600px]",
                    )}
                  >
                    <span
                      className={cx(
                        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold",
                        st.className,
                      )}
                      title={`studentStatus: ${st.key}`}
                    >
                      {st.label}
                    </span>
                  </td>

                  <td
                    className={cx(
                      TD_BASE,
                      "align-middle",
                      stickyLeft,
                      "left-[700px]",
                      "shadow-[2px_0_0_0_rgba(0,0,0,0.06)]",
                    )}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {isEMS ? (
                        <button
                          type="button"
                          onClick={() => openReceiveModal(stu)}
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          รับผ่าน ปณ
                        </button>
                      ) : receiveSigUrl ? (
                        <button
                          type="button"
                          onClick={() => openReceiveModal(stu)}
                          className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          รับเอกสารแล้ว
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openReceiveModal(stu)}
                          className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100"
                        >
                          ยังไม่รับเอกสาร
                        </button>
                      )}

                      {staffDone ? (
                        <button
                          type="button"
                          onClick={() => openStaffModal(stu)}
                          className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          เอกสารนำส่ง
                        </button>
                      ) : null}
                    </div>
                  </td>

                  {days.map((d) => {
                    const dayYmd = normalizedDayDates?.[Number(d) - 1] || "";
                    const isToday = !!dayYmd && dayYmd === nowBKK.ymd;

                    const typeForDay = getLearnTypeForDay(stu, d);
                    const isLive = typeForDay === "live";
                    const isClassroom = typeForDay === "classroom";

                    const checked = getCheckinChecked(stu, d);
                    const timeRaw = getCheckinTimeRaw(stu, d);
                    const timeLabel = formatTimeTH(timeRaw);

                    const { mode, status } = getAttendanceMode(stu, d);
                    const sigUrl = getCheckinSignatureUrl(stu, d);
                    const hasSignature = !!sigUrl;

                    // ✅ โหมดพิเศษที่ถูก “บันทึกไว้แล้ว” (จาก backend ในอนาคต)
                    if (status === "absent") {
                      return (
                        <td
                          key={d}
                          className="px-3 py-2 h-[90px] text-center group-hover/row:bg-admin-surfaceMuted/70"
                        >
                          <div className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-700">
                            ไม่เข้าเรียน
                          </div>
                        </td>
                      );
                    }
                    if (mode === "live" && !hasSignature) {
                      return (
                        <td
                          key={d}
                          className="px-3 py-2 h-[90px] text-center group-hover/row:bg-admin-surfaceMuted/70"
                        >
                          <div className="inline-flex items-center justify-center rounded-full border border-[#464EB8] bg-[#7B83EB] px-3 py-1 text-[11px] font-semibold text-white">
                            LIVE CHECK
                          </div>
                        </td>
                      );
                    }

                    // ✅ ถ้ายังไม่เช็คอิน: ทำ auto display ตามเวลา “วันนี้”
                    if (!checked) {
                      // Live after 08:30
                      if (isToday && isLive && nowBKK.minutes >= 8 * 60 + 30) {
                        return (
                          <td
                            key={d}
                            className="px-3 py-2 h-[90px] text-center group-hover/row:bg-admin-surfaceMuted/70"
                          >
                            <div className="inline-flex items-center justify-center rounded-full border border-[#464EB8] bg-[#7B83EB] px-3 py-1 text-[11px] font-semibold text-white">
                              LIVE CHECK
                            </div>
                          </td>
                        );
                      }

                      // Classroom absent after 16:00
                      if (isToday && isClassroom && nowBKK.minutes >= 16 * 60) {
                        return (
                          <td
                            key={d}
                            className="px-3 py-2 h-[90px] text-center group-hover/row:bg-admin-surfaceMuted/70"
                          >
                            <div className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-700">
                              ไม่เข้าเรียน
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={d}
                          className="px-3 py-2 text-admin-textMuted group-hover/row:bg-admin-surfaceMuted/70"
                        >
                          <div className="flex items-center justify-center">
                            <div className="inline-flex items-center justify-center px-2 py-1 text-xs border border-slate-300 bg-slate-50 text-slate-400 rounded-full cursor-not-allowed">
                              ยังไม่เช็กอิน
                            </div>
                          </div>
                        </td>
                      );
                    }

                    // ✅ checked แล้ว
                    // ถ้าเป็น live และไม่มีลายเซ็น -> แสดง LIVE CHECK
                    if (isLive && !hasSignature) {
                      return (
                        <td
                          key={d}
                          className="px-3 py-2 h-[90px] text-center group-hover/row:bg-admin-surfaceMuted/70"
                        >
                          <div className="inline-flex items-center justify-center rounded-full border border-[#464EB8] bg-[#7B83EB] px-3 py-1 text-[11px] font-semibold text-white">
                            LIVE CHECK
                          </div>
                        </td>
                      );
                    }

                    const isLateThisDay = getIsLateForDay(stu, d);
                    const statusText = isLateThisDay ? "สาย" : "ตรงเวลา";

                    const boxBase =
                      "group/btn relative inline-flex flex-col items-center justify-center rounded-xl px-7 py-1 text-[11px] transition";
                    const lateBox = hasSignature
                      ? "border border-red-200 bg-red-50 cursor-pointer hover:bg-red-100"
                      : "border border-red-200 bg-red-50 cursor-default";
                    const okBox = hasSignature
                      ? "border border-emerald-200 bg-emerald-50 cursor-pointer hover:bg-emerald-100"
                      : "border border-emerald-200 bg-emerald-50 cursor-default";

                    const overlayClass = isLateThisDay
                      ? "bg-red-600/90"
                      : "bg-emerald-600/90";

                    return (
                      <td
                        key={d}
                        className="px-3 py-2 h-[90px] text-center group-hover/row:bg-admin-surfaceMuted/70"
                      >
                        <button
                          type="button"
                          aria-label={
                            hasSignature
                              ? `ดูลายเซ็น ${displayName} ${getDayLabel(d)}`
                              : `เช็กอินแล้ว ${getDayLabel(d)}`
                          }
                          onClick={() =>
                            hasSignature && openCheckinPreview(stu, d)
                          }
                          className={`${boxBase} ${isLateThisDay ? lateBox : okBox}`}
                        >
                          <div
                            className={`flex flex-col items-center justify-center transition-opacity duration-150 ${
                              hasSignature ? "group-hover/btn:opacity-0" : ""
                            }`}
                          >
                            <span className="text-base leading-none">✔</span>

                            {timeLabel && (
                              <span className="mt-0.5 text-[10px] text-admin-textMuted">
                                {timeLabel} น.
                              </span>
                            )}

                            <span
                              className={`mt-0.5 text-[10px] font-semibold ${
                                isLateThisDay
                                  ? "text-red-600"
                                  : "text-emerald-700"
                              }`}
                            >
                              {statusText}
                            </span>
                          </div>

                          {hasSignature && (
                            <div
                              className={`pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl ${overlayClass} text-[14px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover/btn:opacity-100`}
                            >
                              ดูลายเซ็น
                            </div>
                          )}
                        </button>
                      </td>
                    );
                  })}

                  <td
                    className={cx(
                      TD_BASE,
                      "w-[80px] text-center",
                      stickyRight,
                      "relative",
                      "right-0",
                      menuOpenId === stuId ? "z-[200]" : "z-10",
                      "shadow-[-2px_0_0_0_rgba(0,0,0,0.06)]",
                    )}
                  >
                    <div className="relative inline-flex">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const id = stuId;

                          if (menuOpen?.id === id) {
                            setMenuOpen(null);
                            setMenuOpenId("");
                            return;
                          }

                          const btnRect =
                            e.currentTarget.getBoundingClientRect();
                          const top = btnRect.bottom + 8;
                          const left = btnRect.right;

                          setMenuOpenId(id);
                          setMenuOpen({ id, top, left, stu });
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-admin-border bg-white text-admin-text hover:bg-admin-surfaceMuted"
                        aria-label="เมนูนักเรียน"
                        title="จัดการ"
                      >
                        ⋮
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {visible.length === 0 && (
              <tr>
                <td
                  className="px-3 py-10 text-center text-admin-textMuted"
                  colSpan={8 + days.length}
                >
                  ยังไม่มีรายชื่อนักเรียน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {menuOpen?.id && (
        <div
          className="fixed z-[9999]"
          style={{
            top: menuOpen.top,
            left: menuOpen.left,
            transform: "translateX(-100%)",
          }}
          onMouseLeave={() => {
            setMenuOpen(null);
            setMenuOpenId("");
          }}
        >
          <div className="w-44 overflow-hidden rounded-xl border border-admin-border bg-white text-xs shadow-lg">
            <button
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-admin-surfaceMuted"
              onClick={() => openEdit(menuOpen.stu)}
            >
              แก้ไข / เปลี่ยนสถานะ / ประเภท
            </button>

            <button
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-admin-surfaceMuted"
              onClick={() => openLogs(menuOpen.stu)}
            >
              ดูประวัติการแก้ไข
            </button>

            <button
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-admin-surfaceMuted"
              onClick={() => openSigTools(menuOpen.stu)}
            >
              ลบลายเซ็น
            </button>

            <button
              type="button"
              className="w-full px-3 py-2 text-left text-red-600 hover:bg-admin-surfaceMuted"
              onClick={() => openEdit(menuOpen.stu)}
            >
              ลบออกจาก Class
            </button>
          </div>
        </div>
      )}

      {preview && preview.url && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60"
          onClick={closePreview}
        >
          <div
            className=" max-w-2xl rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 text-sm font-semibold text-admin-text">
              {preview.title || "Preview"}
            </div>
            {preview.subtitle && (
              <div className="mb-2 text-xs text-admin-textMuted">
                {preview.subtitle}
              </div>
            )}

            <div className="flex items-center justify-center rounded-xl border border-admin-border bg-admin-surfaceMuted/40 p-3">
              <img
                src={preview.url}
                alt={preview.title || "preview"}
                className="max-h-[50vh] w-auto max-w-full object-contain"
              />
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={closePreview}
                className="rounded-lg bg-brand-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-primary/90"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      <ReceiveDocModal
        open={receiveModal.open}
        stu={receiveModal.stu}
        onClose={closeReceiveModal}
      />

      <StaffDeliverModal
        open={staffModal.open}
        stu={staffModal.stu}
        onClose={closeStaffModal}
      />

      <LogsModal
        open={logsModal.open}
        stu={logsModal.stu}
        onClose={closeLogs}
      />

      <SignatureDeleteModal
        open={sigModal.open}
        stu={sigModal.stu}
        days={days}
        classId={classId}
        onClose={closeSigTools}
        onDeleted={() => {
          closeSigTools();
          onReloadRequested?.();
        }}
      />

      {editOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40"
          onClick={closeEdit}
        >
          <div
            className="w-[95vw] max-w-md rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-sm font-semibold text-admin-text">
              แก้ไขข้อมูลนักเรียน
            </h2>

            <form className="space-y-3" onSubmit={saveEdit}>
              <div>
                <label className="block text-[11px] text-admin-textMuted">
                  ชื่อ - สกุล
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-admin-border px-3 py-1.5 text-xs"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="block text-[11px] text-admin-textMuted">
                  ชื่ออังกฤษ (ถ้ามี)
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-admin-border px-3 py-1.5 text-xs"
                  value={editForm.nameEN}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, nameEN: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="block text-[11px] text-admin-textMuted">
                  บริษัท
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-admin-border px-3 py-1.5 text-xs"
                  value={editForm.company}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, company: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="block text-[11px] text-admin-textMuted">
                  เลขที่ QT / IV / RP
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-admin-border px-3 py-1.5 text-xs"
                  value={editForm.paymentRef}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, paymentRef: e.target.value }))
                  }
                />
              </div>

              {/* ✅ ประเภท */}
              <div>
                <label className="block text-[11px] text-admin-textMuted">
                  ประเภทการเรียน
                  <span className="ml-2 text-[10px] text-admin-textMuted">
                    (มีผลตั้งแต่ “วันปัจจุบัน” ของคลาสเป็นต้นไป)
                  </span>
                </label>
                <select
                  className="mt-1 w-full rounded-lg border border-admin-border px-3 py-1.5 text-xs"
                  value={editForm.learnType}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, learnType: e.target.value }))
                  }
                >
                  <option value="classroom">Classroom</option>
                  <option value="live">Live</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-admin-textMuted">
                    สถานะผู้เรียน
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg border border-admin-border px-3 py-1.5 text-xs"
                    value={editForm.studentStatus}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        studentStatus: e.target.value,
                      }))
                    }
                  >
                    <option value="active">ผู้เรียน</option>
                    <option value="cancelled">ยกเลิก</option>
                    <option value="postponed">เลื่อนวันเรียน</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-admin-textMuted">
                    ช่องทางรับเอกสาร (3.1)
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg border border-admin-border px-3 py-1.5 text-xs"
                    value={editForm.documentReceiveType}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        documentReceiveType: e.target.value,
                      }))
                    }
                  >
                    <option value="ems">รับผ่าน ปณ</option>
                    <option value="on_class">รับ ณ วันอบรม</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex justify-between gap-2">
                <button
                  type="button"
                  onClick={deleteStudent}
                  disabled={editSaving || editDeleting}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  {editDeleting ? "กำลังลบ..." : "ลบนักเรียน"}
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeEdit}
                    disabled={editSaving || editDeleting}
                    className="rounded-lg border border-admin-border px-3 py-1.5 text-xs"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving || editDeleting}
                    className="rounded-lg bg-brand-primary px-4 py-1.5 text-xs text-white disabled:opacity-60"
                  >
                    {editSaving ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                </div>
              </div>

              <div className="text-[10px] text-admin-textMuted">
                * เงื่อนไข LIVE CHECK/ไม่เข้าเรียน ตอนนี้เป็น “การแสดงผล” ใน UI
                ก่อน เพื่อให้ report/export เห็นเหมือนกัน ต้องทำฝั่ง API/Report
                ต่อครับ
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
