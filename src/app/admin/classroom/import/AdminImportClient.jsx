"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import UploadBox from "./UploadBox";
import PrimaryButton from "@/components/ui/PrimaryButton";

function clean(s) {
  return String(s ?? "").trim();
}

function pick(sp, key) {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

function pickName(row) {
  return clean(row?.name) || clean(row?.thaiName) || clean(row?.engName) || "";
}

function normalizePreviewRows(rows) {
  const arr = Array.isArray(rows) ? rows : [];

  const mapped = arr.map((r) => {
    const name = pickName(r);
    return {
      name,
      company: clean(r?.company),
      paymentRef: clean(r?.paymentRef),
      receiveType: clean(r?.receiveType),
      receiveDate: clean(r?.receiveDate),
    };
  });

  // ตัดแถวที่ว่างทุกคอลัมน์ทิ้ง
  return mapped.filter((r) => Object.values(r).some((v) => clean(v) !== ""));
}

export default function ImportPage({ searchParams = {} }) {
  const router = useRouter();

  const initialClassId = useMemo(
    () => pick(searchParams, "classId") || "",
    [searchParams],
  );

  const [csvData, setCsvData] = useState(null);
  const [loading, setLoading] = useState(false);

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(initialClassId);

  // ถ้า query classId เปลี่ยน (เช่น user เปิดลิงก์ใหม่) ให้ sync เข้าสเตท
  useEffect(() => {
    if (initialClassId && initialClassId !== classId)
      setClassId(initialClassId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialClassId]);

  // โหลดรายการ Class
  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await fetch("/api/admin/classes");
        const data = await res.json();
        setClasses(data.items || []);
      } catch (err) {
        console.error(err);
      }
    }
    loadClasses();
  }, []);

  const previewRows = useMemo(() => normalizePreviewRows(csvData), [csvData]);

  const stats = useMemo(() => {
    const total = previewRows.length;
    const missingName = previewRows.reduce(
      (acc, r) => (r.name ? acc : acc + 1),
      0,
    );
    return { total, missingName };
  }, [previewRows]);

  const previewLimit = 20;
  const previewVisible = useMemo(
    () => previewRows.slice(0, previewLimit),
    [previewRows],
  );

  async function handleImport() {
    if (!classId) {
      alert("กรุณาเลือก Class ก่อนนำเข้า");
      return;
    }
    if (!csvData) {
      alert("กรุณาอัปโหลดไฟล์ CSV ก่อน");
      return;
    }

    // ✅ ส่งเฉพาะข้อมูลที่ normalize แล้ว (ตัดแถวขยะออกตั้งแต่หน้า UI)
    if (!previewRows.length) {
      alert("ไม่พบข้อมูลที่อ่านได้จากไฟล์ (หรือไฟล์ว่าง)");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/classroom/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: csvData, classId }),
      });

      const out = await res.json();

      if (!res.ok) {
        alert(out.error || "เกิดข้อผิดพลาด");
        setLoading(false);
        return;
      }

      const extra =
        typeof out.skipped === "number" && out.skipped > 0
          ? ` (ข้าม ${out.skipped} แถวที่ชื่อว่าง)`
          : "";

      alert(`นำเข้าข้อมูลสำเร็จแล้ว (${out.inserted} รายการ)${extra}`);

      // เคลียร์ preview แล้วเด้งกลับไปหน้า Class นั้น
      setCsvData(null);
      router.push(`/admin/classroom/classes/${classId}`);
    } catch (err) {
      console.error(err);
      alert("เกิดปัญหาในการเชื่อมต่อ API");
    }

    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold">นำเข้ารายชื่อนักเรียน (CSV)</h1>

      <p className="mt-2 text-front-textMuted">
        เลือก Class ที่ต้องการ และอัปโหลดไฟล์ CSV ตามรูปแบบที่ระบบกำหนด
      </p>

      {/* เลือก Class */}
      <div className="mt-4">
        <label className="block text-sm">
          <span className="text-admin-text">เลือก Class ที่ต้องการนำเข้า</span>
          <select
            className="mt-1 w-full rounded-lg border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">-- กรุณาเลือก Class --</option>
            {classes.map((c) => (
              <option key={c._id} value={c._id}>
                {c.title} (
                {c.date
                  ? new Date(c.date).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      timeZone: "Asia/Bangkok",
                    })
                  : "-"}
                )
              </option>
            ))}
          </select>
        </label>
      </div>

      <a
        href="/templates/student-template-example.csv"
        download
        className="mt-3 inline-block text-brand-primary underline text-sm"
      >
        ดาวน์โหลด CSV Template
      </a>

      <div className="mt-6">
        <UploadBox onParsed={setCsvData} />
      </div>

      {csvData && (
        <div className="mt-6 border rounded-xl bg-front-bgSoft p-4 shadow">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">พรีวิวข้อมูล</h2>
              <div className="mt-1 text-xs text-front-textMuted">
                ระบบรองรับทั้งไฟล์ใหม่ (<b>name</b>) และไฟล์เก่า (
                <b>thaiName/engName</b>)
              </div>
            </div>

            <div className="text-xs text-front-textMuted">
              ทั้งหมด <span className="font-semibold">{stats.total}</span> แถว
              {stats.missingName > 0 && (
                <>
                  {" "}
                  • ชื่อว่าง{" "}
                  <span className="font-semibold text-red-600">
                    {stats.missingName}
                  </span>{" "}
                  แถว (จะถูกข้ามตอนนำเข้า)
                </>
              )}
            </div>
          </div>

          <div className="mt-3 max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-1 text-left">name</th>
                  <th className="py-1 text-left">company</th>
                  <th className="py-1 text-left">paymentRef</th>
                  <th className="py-1 text-left">receiveType</th>
                  <th className="py-1 text-left">receiveDate</th>
                </tr>
              </thead>

              <tbody>
                {previewVisible.map((row, idx) => {
                  const missing = !row.name;
                  return (
                    <tr
                      key={idx}
                      className="border-b text-front-textMuted"
                      title={
                        missing ? "แถวนี้ชื่อว่าง จะถูกข้ามตอน import" : ""
                      }
                    >
                      <td className="py-1">
                        <div className="flex items-center gap-2">
                          <span>{row.name || "-"}</span>
                          {missing && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                              ชื่อว่าง
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-1">{row.company || "-"}</td>
                      <td className="py-1">{row.paymentRef || "-"}</td>
                      <td className="py-1">{row.receiveType || "-"}</td>
                      <td className="py-1">{row.receiveDate || "-"}</td>
                    </tr>
                  );
                })}

                {previewRows.length > previewLimit && (
                  <tr>
                    <td colSpan={5} className="py-2 text-center text-xs">
                      แสดง {previewLimit} แถวแรก จากทั้งหมด {previewRows.length}{" "}
                      แถว
                    </td>
                  </tr>
                )}

                {previewRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-4 text-center text-front-textMuted"
                    >
                      ไม่พบข้อมูลที่อ่านได้จากไฟล์ (หรือไฟล์ว่าง)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <PrimaryButton
            className="mt-4 w-full"
            onClick={handleImport}
            disabled={loading}
          >
            {loading ? "กำลังนำเข้า..." : "ยืนยันการนำเข้า"}
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}
