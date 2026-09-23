import { Suspense } from "react";
import MasterclassSuccessClient from "./MasterclassSuccessClient";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  return (
    <Suspense fallback={null}>
      <MasterclassSuccessClient searchParams={searchParams || {}} />
    </Suspense>
  );
}
