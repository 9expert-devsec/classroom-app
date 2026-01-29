import { Suspense } from "react";
import EventCheckinClient from "./EventCheckinClient";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  return (
    <Suspense fallback={null}>
      <EventCheckinClient searchParams={searchParams || {}} />
    </Suspense>
  );
}
