import { Suspense } from "react";
import CheckinFoodClient from "./CheckinFoodClient";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  return (
    <Suspense fallback={null}>
      <CheckinFoodClient searchParams={searchParams || {}} />
    </Suspense>
  );
}
