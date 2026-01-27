import AdminImportClient from "./AdminImportClient";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  return <AdminImportClient searchParams={searchParams || {}} />;
}
