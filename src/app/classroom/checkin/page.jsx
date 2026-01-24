import { Suspense } from "react";
import CheckinClient from "./CheckinClient";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  return (
    <Suspense fallback={null}>
      <CheckinClient searchParams={searchParams || {}} />
    </Suspense>
  );
}
