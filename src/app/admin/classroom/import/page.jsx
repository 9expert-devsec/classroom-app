// src/app/admin/classroom/import/page.jsx
import { Suspense } from "react";
import AdminImportClient from "./AdminImportClient";

export const dynamic = "force-dynamic"; // กัน prerender ง่ายๆ ด้วย

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AdminImportClient />
    </Suspense>
  );
}