// src/app/admin/classroom/classes/[id]/StudentsTable.jsx
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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
    timeZone: "Asia/Bangkok",
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
    timeZone: "Asia/Bangkok",
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
    timeZone: "Asia/Bangkok",
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

/* ================= Receive helpers (3.1 customer_receive) ================= */

function ReceiveDocModal({ open, stu, onClose, onPreview }) {
  if (!open) return null;

  const sig = getReceiveSignatureUrl(stu);
  const receivedAt = getReceivedAt(stu);
  const typeRaw = getReceiveTypeRaw(stu);
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
                {sig ? (
                  <span className="text-emerald-700 ">รับเอกสารแล้ว</span>
                ) : (
                  <span className="text-zinc-700 ">ยังไม่รับเอกสาร</span>
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

          {/* ลายเซ็นรับเอกสาร */}
          <div className="mt-3 rounded-2xl border border-admin-border bg-white p-4">
            <div className="text-sm text-admin-textMuted">ลายเซ็นรับเอกสาร</div>

            {sig ? (
              <div className="mt-2 flex items-center justify-center rounded-xl border border-admin-border bg-admin-surfaceMuted/40 ">
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
  if (x === "ems") return "ส่งทางไปรษณีย์";
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

function StaffDeliverModal({
  open,
  stu,
  onClose,
  onPreviewCustomer,
  onPreviewStaff,
}) {
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

          {/* <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-admin-border p-3">
            {customerUrl ? (
              <button
                type="button"
                onClick={onPreviewCustomer}
                className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
              >
                ลายเซ็นลูกค้า
              </button>
            ) : (
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] text-zinc-600">
                ลายเซ็นลูกค้า -
              </span>
            )}

            {staffUrl ? (
              <button
                type="button"
                onClick={onPreviewStaff}
                className="rounded-full border border-purple-200 bg-white px-3 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-50"
              >
                ลายเซ็นเจ้าหน้าที่
              </button>
            ) : (
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] text-zinc-600">
                ลายเซ็นเจ้าหน้าที่ -
              </span>
            )}
          </div> */}
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

  // ✅ รองรับ API ใหม่ที่ส่ง checkinDaily[]
  if (Array.isArray(stu?.checkinDaily)) {
    const found = stu.checkinDaily.find((x) => Number(x.day) === Number(day));
    if (found && found.checkedIn) {
      return {
        signatureUrl: found.signatureUrl,
        time: found.time,
        isLate: found.isLate,
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

/* ================= Student status (active/cancelled/postponed) ================= */

function getStudentStatusRaw(stu) {
  // ✅ ชื่อจริงใน schema: studentStatus
  // ✅ เผื่อ legacy: status
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

export default function StudentsTable({
  students,
  dayCount,

  // ✅ ใหม่ (optional)
  classId = "",

  // ✅ selection (controlled optional)
  selectedIds,
  onSelectedIdsChange,

  // ✅ callbacks (optional)
  onReloadRequested,
}) {
  // const [search, setSearch] = useState("");
  // const [page, setPage] = useState(1);

  // preview: { url, title, subtitle }
  const [preview, setPreview] = useState(null);

  // row menu
  const [menuOpenId, setMenuOpenId] = useState("");

  // ✅ overrides: แก้ปัญหา API class ไม่ส่ง studentStatus กลับมา
  const [overridesById, setOverridesById] = useState({});

  // edit modal
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
  });

  const viewportRef = useRef(null);
  const tableRef = useRef(null);

  const pageSize = useAutoPageSize({
    viewportRef,
    tableRef,
    min: 2,
    max: 10,
    fallbackRowHeight: 64,
    padding: 8,
  });

  const days = useMemo(
    () => Array.from({ length: dayCount || 1 }, (_, i) => i + 1),
    [dayCount],
  );

  // ----- selection (controlled/uncontrolled) -----
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

  function clearSelection() {
    setSel([]);
  }

  // ✅ merge overrides ลง students เพื่อ render
  const mergedStudents = useMemo(() => {
    const list = Array.isArray(students) ? students : [];
    if (!list.length) return [];
    return list.map((s) => {
      const id = getStudentId(s);
      const ov = id ? overridesById[id] : null;
      return ov ? { ...s, ...ov } : s;
    });
  }, [students, overridesById]);

  // ----- search filter -----
  // const filtered = useMemo(() => {
  //   const q = search.trim().toLowerCase();
  //   if (!q) return mergedStudents;

  //   return mergedStudents.filter((s) => {
  //     const staffItems = getStaffReceiveItems(s);
  //     const staffLabel = staffItemsLabel(staffItems);
  //     const st = studentStatusMeta(getStudentStatusRaw(s));

  //     const pieces = [
  //       getStudentName(s),
  //       getStudentNameEN(s),
  //       s.company,
  //       s.paymentRef,

  //       // status
  //       st.label,
  //       st.key,

  //       // 3.1
  //       getReceiveTypeRaw(s),
  //       receiveTypeLabel(getReceiveTypeRaw(s)),
  //       formatDateTH(getReceivedAt(s)),

  //       // 3.2
  //       staffLabel,
  //       formatDateTimeTH(getStaffReceiveUpdatedAt(s)),
  //     ];
  //     return pieces.some((p) => (p || "").toString().toLowerCase().includes(q));
  //   });
  // }, [mergedStudents, search]);

  // const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  // const currentPage = Math.min(page, totalPages);
  // const start = (currentPage - 1) * pageSize;
  // const visible = filtered.slice(start, start + pageSize);
  const visible = mergedStudents; // parent ส่งมาแล้ว

  const visibleIds = useMemo(() => {
    return visible.map((s) => getStudentId(s)).filter(Boolean);
  }, [visible]);

  // useEffect(() => {
  //   setPage((p) => Math.min(p, totalPages));
  // }, [totalPages]);

  function goPrev() {
    setPage((p) => Math.max(1, p - 1));
  }
  function goNext() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  function openCheckinPreview(stu, day) {
    const url = getCheckinSignatureUrl(stu, day);
    if (!url) return;

    const timeLabel = formatTimeTH(getCheckinTimeRaw(stu, day)) || "";
    const isLate = getIsLateForDay(stu, day);

    setPreview({
      url,
      title: "ลายเซ็นเช็กอิน",
      subtitle: `${getStudentName(stu)} • Day ${day}${
        timeLabel ? ` • เวลา ${timeLabel} น.` : ""
      }${isLate ? " • สาย" : " • ตรงเวลา"}`,
    });
  }

  function openReceivePreview(stu) {
    const url = getReceiveSignatureUrl(stu);
    if (!url) return;

    const receivedAt = getReceivedAt(stu);
    const receivedAtLabel = receivedAt ? formatDateTH(receivedAt) : "";

    setPreview({
      url,
      title: "ลายเซ็นรับเอกสาร (3.1)",
      subtitle: `${getStudentName(stu)}${
        receivedAtLabel ? ` • วันที่รับเอกสาร ${receivedAtLabel}` : ""
      }`,
    });
  }

  function openStaffReceivePreview(stu, who) {
    const isCustomer = who === "customer";
    const url = isCustomer
      ? getStaffReceiveCustomerSigUrl(stu)
      : getStaffReceiveStaffSigUrl(stu);
    if (!url) return;

    const updatedAt = getStaffReceiveUpdatedAt(stu);
    const updatedAtLabel =
      updatedAt && updatedAt !== "-"
        ? ` • บันทึกเมื่อ ${formatDateTimeTH(updatedAt)}`
        : "";

    const items = getStaffReceiveItems(stu);
    const itemsLabel = staffItemsLabel(items);
    const itemsText = itemsLabel ? ` • ${itemsLabel}` : "";

    setPreview({
      url,
      title: isCustomer
        ? "ลายเซ็นผู้ส่งเอกสาร (ลูกค้า) • 3.2"
        : "ลายเซ็นเจ้าหน้าที่รับเอกสาร • 3.2",
      subtitle: `${getStudentName(stu)}${updatedAtLabel}${itemsText}`,
    });
  }

  function closePreview() {
    setPreview(null);
  }

  // ----- edit actions -----
  function openEdit(stu) {
    const id = getStudentId(stu);
    if (!id) return;

    setMenuOpenId("");
    setEditStuId(id);

    setEditForm({
      name:
        clean(stu?.name) || clean(stu?.thaiName) || clean(stu?.nameTH) || "",
      nameEN: clean(stu?.nameEN) || clean(stu?.engName) || "",
      company: clean(stu?.company) || "",
      paymentRef: clean(stu?.paymentRef) || "",
      studentStatus: studentStatusMeta(getStudentStatusRaw(stu)).key,
      documentReceiveType: clean(stu?.documentReceiveType) || "ems",
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

    setEditSaving(true);
    try {
      const payload = {
        name: clean(editForm.name),
        // backend เดิมใช้ engName แต่ UI ใช้ nameEN -> ส่งทั้งคู่ให้ชัวร์
        nameEN: clean(editForm.nameEN),
        engName: clean(editForm.nameEN),

        company: clean(editForm.company),
        paymentRef: clean(editForm.paymentRef),

        documentReceiveType: clean(editForm.documentReceiveType) || "ems",
        studentStatus: clean(editForm.studentStatus) || "active",
      };

      const res = await fetch(
        `/api/admin/classes/${encodeURIComponent(
          classId,
        )}/students/${encodeURIComponent(editStuId)}`,
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

      // ✅ FIX: แม้ reload class จะไม่ส่ง studentStatus กลับมา
      // เราจะ override ใน UI ทันทีจาก payload/response
      const fromRes = data?.student || null;
      setOverridesById((m) => ({
        ...m,
        [editStuId]: {
          name: payload.name,
          // ใส่ทั้ง nameEN/engName เพื่อให้ helper โชว์ EN line ได้
          nameEN: payload.nameEN,
          engName: payload.engName,
          company: payload.company,
          paymentRef: payload.paymentRef,
          documentReceiveType: payload.documentReceiveType,
          studentStatus: fromRes?.studentStatus || payload.studentStatus,
        },
      }));

      alert("บันทึกเรียบร้อย");
      setEditOpen(false);

      // ยังเรียก reload ได้ (แต่ต่อให้ API ไม่ส่ง status มา UI ก็ยังถูก เพราะ override)
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
        `/api/admin/classes/${encodeURIComponent(
          classId,
        )}/students/${encodeURIComponent(editStuId)}`,
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
    const onScroll = () => setMenuOpen(null);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const [receiveModal, setReceiveModal] = useState({ open: false, stu: null });
  const [staffModal, setStaffModal] = useState({ open: false, stu: null });

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

  return (
    <>
      {/* search + summary + selection bar */}
      {/* <div className="mb-3 flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <div className="text-xs text-admin-textMuted">
              รายชื่อนักเรียน {filtered.length} คน
              {filtered.length !== mergedStudents.length && (
                <span> (ทั้งหมด {mergedStudents.length} คน)</span>
              )}
            </div>

            <div className="text-xs text-admin-textMuted">
              เลือกแล้ว{" "}
              <span className="font-semibold text-admin-text">
                {sel.length}
              </span>{" "}
              คน
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="ค้นหาชื่อ / บริษัท / เลข QT/IV/RP ... (รองรับค้นหา 3.2 ด้วย)"
              className="w-full rounded-lg border border-admin-border bg-white px-3 py-1.5 text-xs text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary sm:w-80"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="text-admin-textMuted">
            เลือกแล้ว{" "}
            <span className="font-semibold text-admin-text">{sel.length}</span>{" "}
            คน
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => toggleSelectAllVisible(visibleIds)}
              className="rounded-full border border-admin-border bg-white px-3 py-1 text-[11px] font-medium text-admin-text hover:bg-admin-surfaceMuted"
              disabled={!visibleIds.length}
              title="เลือก/ยกเลิกเลือกเฉพาะรายการที่แสดงในหน้านี้"
            >
              {isAllVisibleSelected(visibleIds)
                ? "ยกเลิกเลือก (หน้านี้)"
                : "เลือกทั้งหมด (หน้านี้)"}
            </button>

            <button
              type="button"
              onClick={clearSelection}
              className="rounded-full border border-admin-border bg-white px-3 py-1 text-[11px] font-medium text-admin-text hover:bg-admin-surfaceMuted"
              disabled={!sel.length}
            >
              ล้างที่เลือก
            </button>
          </div>
        </div>
      </div> */}

      <div
        ref={viewportRef}
        className="min-h-0 flex-1  overflow-auto rounded-xl"
      >
        <table
          ref={tableRef}
          className="min-w-full w-max table-fixed border-separate border-spacing-0 text-xs sm:text-sm "
        >
          <colgroup>
            <col className="w-[50px]" />
            <col className="w-[150px]" />
            <col className="w-[160px]" />
            <col className="w-[130px]" />
            <col className="w-[100px]" />
            <col className="w-[150px]" />

            {days.map((d) => (
              <col key={`col-day-${d}`} className="w-[150px]" />
            ))}

            <col className="w-[80px]" />
          </colgroup>
          <thead className=" text-[#0a1f33] uppercase text-[11px]">
            <tr>
              {/* selection column */}
              <th
                className={cx(
                  TH_BASE,

                  stickyTopHead,
                  stickyLeftHead,
                  "left-0",
                )}
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

              <th
                className={cx(
                  TH_BASE,
                  "text-center",
                  stickyTopHead,
                  stickyLeftHead,
                  "left-[490px]",
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
                  "left-[590px]",
                  "shadow-[2px_0_0_0_rgba(0,0,0,0.06)]", // เส้นแบ่งกับส่วน scroll
                )}
              >
                เอกสาร
              </th>

              {/* <th className="px-3 py-2 text-center w-[150px]">
                ช่องทางรับเอกสาร
              </th>
              <th className="px-3 py-2 text-center w-[130px]">
                วันที่รับเอกสาร
              </th> */}

              {/* 3.1 */}
              {/* <th className="px-3 py-2 text-center w-[140px]">
                ลายเซ็นรับเอกสาร (3.1)
              </th> */}

              {/* 3.2 */}
              {/* <th className="px-3 py-2 text-center w-[220px]">
                นำส่งเอกสาร (3.2)
              </th> */}

              {days.map((d) => (
                <th
                  key={d}
                  className={cx(
                    TH_BASE,
                    "text-center bg-[#66ccff]",
                    stickyTopHead,
                  )}
                >
                  DAY {d}
                </th>
              ))}

              <th
                className={cx(
                  TH_BASE,
                  "text-center ",
                  stickyTopHead,
                  stickyRightHead,
                  "right-0",
                  "shadow-[-2px_0_0_0_rgba(0,0,0,0.06)]", // เส้นแบ่งด้านซ้ายของปุ่มจัดการ
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

              const receiveTypeRaw = getReceiveTypeRaw(stu);
              const receiveTypeText = receiveTypeLabel(receiveTypeRaw);
              const receivedAt = getReceivedAt(stu);
              const receiveSigUrl = getReceiveSignatureUrl(stu);

              const staffUpdatedAt = getStaffReceiveUpdatedAt(stu);
              const staffItems = getStaffReceiveItems(stu);
              const staffItemsText = staffItemsLabel(staffItems);
              const staffCustomerUrl = getStaffReceiveCustomerSigUrl(stu);
              const staffStaffUrl = getStaffReceiveStaffSigUrl(stu);
              const staffDone = !!(
                staffCustomerUrl ||
                staffStaffUrl ||
                staffUpdatedAt
              );

              const st = studentStatusMeta(getStudentStatusRaw(stu));

              return (
                <tr
                  key={stuId || i}
                  className={cx(
                    "group/row h-16 border-t border-admin-border ",
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

                  <td
                    className={cx(
                      TD_BASE,

                      stickyLeft,
                      "left-[50px]",
                    )}
                  >
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
                      "whitespace-normal break-all text-admin-textMuted text-wrap ",
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

                  {/* status */}
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
                      "left-[590px]",
                      "shadow-[2px_0_0_0_rgba(0,0,0,0.06)]",
                    )}
                  >
                    {/* เอกสาร (สรุป) */}
                    <div className="flex flex-col items-center gap-2">
                      {/* ปุ่มรับเอกสาร: แสดงเสมอ */}
                      {receiveSigUrl ? (
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

                      {/* ปุ่มนำส่งเอกสาร: แสดงเฉพาะเมื่อมีข้อมูล */}
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

                  {/* <td className="px-3 py-2 text-admin-textMuted text-center">
                    {receiveTypeText}
                  </td>

                  <td className="px-3 py-2 text-center text-admin-textMuted">
                    {receivedAt ? formatDateTH(receivedAt) : "-"}
                  </td> */}

                  {/* 3.1 */}
                  {/* <td className="px-3 py-2 text-center">
                    {receiveSigUrl ? (
                      <button
                        type="button"
                        onClick={() => openReceivePreview(stu)}
                        className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
                      >
                        ดูลายเซ็น
                      </button>
                    ) : (
                      <span className="text-admin-textMuted">-</span>
                    )}
                  </td> */}

                  {/* 3.2 */}
                  {/* <td className="px-3 py-2 text-center">
                    {staffDone ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {staffCustomerUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                openStaffReceivePreview(stu, "customer")
                              }
                              className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
                              title="ดูลายเซ็นผู้ส่งเอกสาร (ลูกค้า)"
                            >
                              ลูกค้า
                            </button>
                          ) : (
                            <span className="rounded-full border border-admin-border bg-admin-surfaceMuted px-3 py-1 text-[11px] text-admin-textMuted">
                              ลูกค้า-
                            </span>
                          )}

                          {staffStaffUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                openStaffReceivePreview(stu, "staff")
                              }
                              className="rounded-full border border-purple-200 bg-white px-3 py-1 text-[11px] font-medium text-purple-700 hover:bg-purple-50"
                              title="ดูลายเซ็นเจ้าหน้าที่รับเอกสาร"
                            >
                              จนท.
                            </button>
                          ) : (
                            <span className="rounded-full border border-admin-border bg-admin-surfaceMuted px-3 py-1 text-[11px] text-admin-textMuted">
                              จนท.-
                            </span>
                          )}

                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                            บันทึกแล้ว
                          </span>
                        </div>

                        <div className="text-[11px] text-admin-textMuted">
                          {staffUpdatedAt
                            ? `เมื่อ ${formatDateTimeTH(staffUpdatedAt)}`
                            : ""}
                        </div>

                        {staffItemsText ? (
                          <div className="text-[11px] text-admin-textMuted">
                            {staffItemsText}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-700">
                        ยังไม่บันทึก
                      </span>
                    )}
                  </td> */}

                  {days.map((d) => {
                    const checked = getCheckinChecked(stu, d);
                    const timeRaw = getCheckinTimeRaw(stu, d);
                    const timeLabel = formatTimeTH(timeRaw);

                    if (!checked) {
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

                    const sigUrl = getCheckinSignatureUrl(stu, d);
                    const hasSignature = !!sigUrl;

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
                              ? `ดูลายเซ็น ${displayName} Day ${d}`
                              : `เช็กอินแล้ว Day ${d}`
                          }
                          onClick={() =>
                            hasSignature && openCheckinPreview(stu, d)
                          }
                          className={`${boxBase} ${
                            isLateThisDay ? lateBox : okBox
                          }`}
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

                  {/* actions */}
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
                        onClick={
                          (e) => {
                            e.stopPropagation();
                            const id = stuId;

                            // toggle ปิด
                            if (menuOpen?.id === id) {
                              setMenuOpen(null);
                              return;
                            }

                            const btnRect =
                              e.currentTarget.getBoundingClientRect();

                            // ให้เมนูออกด้านล่างปุ่ม
                            const top = btnRect.bottom + 8;
                            const left = btnRect.right; // ใช้เป็น anchor ขวา

                            setMenuOpen({ id, top, left, stu });
                          }
                          // setMenuOpenId(menuOpenId === stuId ? "" : stuId)
                        }
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
                  colSpan={10 + days.length}
                >
                  ยังไม่มีรายชื่อนักเรียน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      {/* {filtered.length > pageSize && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentPage <= 1}
            className="rounded-lg border border-admin-border px-2 py-1 disabled:opacity-50"
          >
            ก่อนหน้า
          </button>
          <span className="text-admin-textMuted">
            หน้า {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={currentPage >= totalPages}
            className="rounded-lg border border-admin-border px-2 py-1 disabled:opacity-50"
          >
            ถัดไป
          </button>
        </div>
      )} */}

      {menuOpen?.id && (
        <div
          className="fixed z-[9999]"
          style={{
            top: menuOpen.top,
            left: menuOpen.left,
            transform: "translateX(-100%)", // ชิดขวาของปุ่ม
          }}
          onMouseLeave={() => setMenuOpen(null)}
        >
          <div className="w-40 overflow-hidden rounded-xl border border-admin-border bg-white text-xs shadow-lg">
            <button
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-admin-surfaceMuted"
              onClick={() => openEdit(menuOpen.stu)}
            >
              แก้ไข / เปลี่ยนสถานะ
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

      {/* Preview Modal */}
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
        onPreview={() => {
          const s = receiveModal.stu;
          closeReceiveModal();
          openReceivePreview(s);
        }}
      />

      <StaffDeliverModal
        open={staffModal.open}
        stu={staffModal.stu}
        onClose={closeStaffModal}
        onPreviewCustomer={() => {
          const s = staffModal.stu;
          closeStaffModal();
          openStaffReceivePreview(s, "customer");
        }}
        onPreviewStaff={() => {
          const s = staffModal.stu;
          closeStaffModal();
          openStaffReceivePreview(s, "staff");
        }}
      />

      {/* Edit Modal */}
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
                    <option value="ems">ส่งไปรษณีย์</option>
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

              {/* หมายเหตุ */}
              {/* <div className="pt-1 text-[11px] text-admin-textMuted">
                * ถ้า API โหลด class ยังไม่ส่ง <code>studentStatus</code> กลับมา
                UI จะยึดค่า override จากการแก้ล่าสุดเพื่อให้แสดงถูก
              </div> */}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
