import { Suspense } from "react";
import EditUserClient from "./EditUserClient";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  return (
    <Suspense fallback={null}>
      <EditUserClient searchParams={searchParams || {}} />
    </Suspense>
  );
}
