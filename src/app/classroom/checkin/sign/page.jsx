import { Suspense } from "react";
import CheckinSignClient from "./CheckinSignClient";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  return (
    <Suspense fallback={null}>
      <CheckinSignClient searchParams={searchParams || {}} />
    </Suspense>
  );
}
