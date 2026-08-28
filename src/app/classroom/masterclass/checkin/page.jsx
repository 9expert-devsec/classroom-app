import { Suspense } from "react";
import MasterclassCheckinClient from "./MasterclassCheckinClient";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  return (
    <Suspense fallback={null}>
      <MasterclassCheckinClient searchParams={searchParams || {}} />
    </Suspense>
  );
}
