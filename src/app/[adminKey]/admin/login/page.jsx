// src/app/[adminKey]/admin/login/page.jsx
import AdminLoginClient from "./AdminLoginClient";

export default function Page({ params, searchParams }) {
  return (
    <AdminLoginClient
      adminKey={String(params?.adminKey || "")}
      searchParams={searchParams || {}}
    />
  );
}
