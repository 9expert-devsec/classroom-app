// src/app/admin/classroom/classes/[id]/StudentsTable.jsx
"use client";

import { useMemo, useState } from "react";

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

export default function StudentsTable({ students, dayCount }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState(null); // { url, studentName, day, time }

  const pageSize = 10;

  const days = useMemo(
    () => Array.from({ length: dayCount || 1 }, (_, i) => i + 1),
    [dayCount]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;

    return students.filter((s) => {
      const pieces = [
        s.nameTH,
        s.nameEN,
        s.company,
        s.paymentRef,
        s.receiveType,
        formatDateTH(s.receiveDate),
      ];
      return pieces.some((p) => (p || "").toString().toLowerCase().includes(q));
    });
  }, [students, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  function goPrev() {
    setPage((p) => Math.max(1, p - 1));
  }
  function goNext() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  function openPreview(stu, day) {
    const info = stu.checkins?.[day]; // มาจาก API: { isLate, time, signatureUrl }
    if (!info?.signatureUrl) return;

    const timeLabel =
      formatTimeTH(info.time || stu.checkinTimes?.[`day${day}`]) || "";

    setPreview({
      url: info.signatureUrl,
      studentName: stu.nameTH || stu.name || "",
      day,
      time: timeLabel,
    });
  }

  function closePreview() {
    setPreview(null);
  }

  return (
    <>
      {/* search + summary */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-admin-textMuted">
          รายชื่อนักเรียน {filtered.length} คน
          {filtered.length !== students.length && (
            <span> (ทั้งหมด {students.length} คน)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="ค้นหาชื่อ / บริษัท / เลขใบเสร็จ ..."
            className="w-full rounded-lg border border-admin-border bg-white px-3 py-1.5 text-xs text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary sm:w-72"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="overflow-auto max-h-[calc(100vh-470px)]">
        <table className="min-w-full text-xs sm:text-sm">
          <thead className="sticky top-0 z-10 bg-admin-surfaceMuted text-admin-textMuted uppercase text-[11px]">
            <tr>
              <th className="px-3 py-2 text-left">ชื่อ - สกุล</th>
              <th className="px-3 py-2 text-left">บริษัท</th>
              <th className="px-3 py-2 text-left">เลขใบเสร็จ</th>
              <th className="px-3 py-2 text-left">ช่องทางรับเอกสาร</th>
              <th className="px-3 py-2 text-left ">วันที่รับเอกสาร</th>
              {days.map((d) => (
                <th key={d} className="px-3 py-2 text-center w-[150px]">
                  DAY {d}
                </th>
              ))}
              {/* <th className="px-3 py-2 text-center">สถานะสาย</th> */}
            </tr>
          </thead>

          <tbody>
            {visible.map((stu, i) => (
              <tr
                key={stu._id || i}
                className="border-t border-admin-border hover:bg-admin-surfaceMuted/60"
              >
                <td className="px-3 py-2">
                  {stu.nameTH || stu.name || "-"}
                  <div className="text-[11px] text-admin-textMuted">
                    {stu.nameEN || ""}
                  </div>
                </td>

                <td className="px-3 py-2 text-admin-textMuted">
                  {stu.company || "-"}
                </td>

                <td className="px-3 py-2 text-admin-textMuted">
                  {stu.paymentRef || "-"}
                </td>

                <td className="px-3 py-2 text-admin-textMuted">
                  {stu.receiveType || "-"}
                </td>

                <td className="px-3 py-2 text-admin-textMuted">
                  {stu.receiveDate ? formatDateTH(stu.receiveDate) : "-"}
                </td>

                {days.map((d) => {
                  const checked = stu.checkin?.[`day${d}`];
                  const timeRaw =
                    stu.checkinTimes?.[`day${d}`] ||
                    stu.checkins?.[d]?.time ||
                    null;
                  const timeLabel = formatTimeTH(timeRaw);

                  if (!checked) {
                    return (
                      <td
                        key={d}
                        className="px-3 py-2 text-center text-admin-textMuted"
                      >
                        -
                      </td>
                    );
                  }

                  const hasSignature = !!stu.checkins?.[d]?.signatureUrl;

                  return (
                    <td key={d} className="px-3 py-2 text-center">
                      {/* <button
                        type="button"
                        onClick={() => hasSignature && openPreview(stu, d)}
                        className={`inline-flex flex-col items-center justify-center rounded-xl px-7 py-1 text-[11px] ${
                          hasSignature
                            ? "border border-brand-primary/60 bg-white hover:bg-brand-primary/5"
                            : "border border-admin-border bg-admin-surfaceMuted cursor-default"
                        }`}
                      >
                        <span className="text-base leading-none">
                          {hasSignature ? "✔" : "✔"}
                        </span>
                        {timeLabel && (
                          <span className="mt-0.5 text-[10px] text-admin-textMuted">
                            {timeLabel} น.
                          </span>
                        )}
                        {hasSignature && (
                          <span className="mt-0.5 text-[10px] text-brand-primary">
                            ดูลายเซ็น
                          </span>
                        )}
                        {stu.statusLabel && stu.statusLabel !== "-" ? (
                          <span
                            className={
                              stu.late
                                ? "text-red-500 font-semibold"
                                : "text-emerald-600 font-semibold"
                            }
                          >
                            {stu.statusLabel}
                          </span>
                        ) : (
                          "-"
                        )}
                      </button> */}
                      <button
                        type="button"
                        onClick={() => hasSignature && openPreview(stu, d)}
                        className={`group relative inline-flex flex-col items-center justify-center rounded-xl px-7 py-1 text-[11px]
    ${
      hasSignature
        ? "border border-brand-primary/60 bg-white cursor-pointer"
        : "border border-admin-border bg-admin-surfaceMuted cursor-default"
    }
  `}
                      >
                        {/* เนื้อหาปกติของปุ่ม */}
                        <div
                          className={`
      flex flex-col items-center justify-center
      transition-opacity duration-150
      ${hasSignature ? "group-hover:opacity-0" : ""}
    `}
                        >
                          <span className="text-base leading-none">✔</span>

                          {timeLabel && (
                            <span className="mt-0.5 text-[10px] text-admin-textMuted">
                              {timeLabel} น.
                            </span>
                          )}

                          {stu.statusLabel && stu.statusLabel !== "-" && (
                            <span
                              className={
                                stu.late
                                  ? "mt-0.5 text-[10px] font-semibold text-red-500"
                                  : "mt-0.5 text-[10px] font-semibold text-emerald-600"
                              }
                            >
                              {stu.statusLabel}
                            </span>
                          )}
                        </div>

                        {/* overlay "ดูลายเซ็น" ทับด้านบนเวลา hover */}
                        {hasSignature && (
                          <div className=" pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-brand-primary/90 text-[14px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            ดูลายเซ็น
                          </div>
                        )}
                      </button>
                    </td>
                  );
                })}

                {/* <td className="px-3 py-2 text-center">
                  {stu.statusLabel && stu.statusLabel !== "-" ? (
                    <span
                      className={
                        stu.late
                          ? "text-red-500 font-semibold"
                          : "text-emerald-600 font-semibold"
                      }
                    >
                      {stu.statusLabel}
                    </span>
                  ) : (
                    "-"
                  )}
                </td> */}
              </tr>
            ))}

            {visible.length === 0 && (
              <tr>
                <td
                  className="px-3 py-4 text-center text-admin-textMuted"
                  colSpan={5 + days.length + 1}
                >
                  ยังไม่มีรายชื่อนักเรียน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      {filtered.length > pageSize && (
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
      )}

      {/* ✅ Signature Preview Modal */}
      {preview && preview.url && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60"
          onClick={closePreview}
        >
          <div
            className="max-h-[80vh] w-[90vw] max-w-md rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 text-sm font-semibold text-admin-text">
              ลายเซ็นผู้เรียน
            </div>
            <div className="mb-2 text-xs text-admin-textMuted">
              {preview.studentName} • Day {preview.day}
              {preview.time && ` • เวลา ${preview.time} น.`}
            </div>
            <div className="flex items-center justify-center rounded-xl border border-admin-border bg-admin-surfaceMuted/40 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.url}
                alt={`Signature Day ${preview.day}`}
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
    </>
  );
}
