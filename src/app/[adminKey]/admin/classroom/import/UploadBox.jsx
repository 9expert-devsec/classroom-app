"use client";

import { useState } from "react";
import Papa from "papaparse";

export default function UploadBox({ onParsed }) {
  const [fileName, setFileName] = useState("");

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        onParsed(results.data);
      },
      error: () => {
        alert("ไฟล์ CSV ไม่ถูกต้อง");
      },
    });
  }

  return (
    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-brand-border bg-white py-8 text-center shadow-sm hover:bg-front-bgSoft transition">
      <input type="file" accept=".csv" className="hidden" onChange={handleFile} />

      <span className="text-sm text-front-text">
        เลือกไฟล์ CSV เพื่อนำเข้า
      </span>
      <span className="mt-2 text-xs text-front-textMuted">{fileName}</span>
    </label>
  );
}
