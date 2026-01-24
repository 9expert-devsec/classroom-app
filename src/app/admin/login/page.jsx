import AdminLoginClient from "./AdminLoginClient";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  return <AdminLoginClient searchParams={searchParams || {}} />;
}
