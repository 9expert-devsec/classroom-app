"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import UploadBox from "./UploadBox";
import PrimaryButton from "@/components/ui/PrimaryButton";

export default function ImportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialClassId = searchParams.get("classId") || "";

  const [csvData, setCsvData] = useState(null);
  const [loading, setLoading] = useState(false);

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(initialClassId);

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

  async function handleImport() {
    if (!classId) {
      alert("กรุณาเลือก Class ก่อนนำเข้า");
      return;
    }
    if (!csvData) {
      alert("กรุณาอัปโหลดไฟล์ CSV ก่อน");
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

      alert(`นำเข้าข้อมูลสำเร็จแล้ว (${out.inserted} รายการ)`);

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
          <h2 className="text-lg font-semibold">พรีวิวข้อมูล</h2>

          <div className="mt-3 max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {Object.keys(csvData[0]).map((key) => (
                    <th key={key} className="py-1 text-left">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {csvData.map((row, idx) => (
                  <tr key={idx} className="border-b text-front-textMuted">
                    {Object.values(row).map((v, i) => (
                      <td key={i} className="py-1">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
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
