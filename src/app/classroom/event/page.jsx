import { Suspense } from "react";
import EventSelectClient from "./EventSelectClient";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  return (
    <Suspense fallback={null}>
      <EventSelectClient searchParams={searchParams || {}} />
    </Suspense>
  );
}
