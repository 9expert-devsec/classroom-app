import { Suspense } from "react";
import CheckinSuccessClient from "./CheckinSuccessClient";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  return (
    <Suspense fallback={null}>
      <CheckinSuccessClient searchParams={searchParams || {}} />
    </Suspense>
  );
}
