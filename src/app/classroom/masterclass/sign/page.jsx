import { Suspense } from "react";
import MasterclassSignClient from "./MasterclassSignClient";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  return (
    <Suspense fallback={null}>
      <MasterclassSignClient searchParams={searchParams || {}} />
    </Suspense>
  );
}
