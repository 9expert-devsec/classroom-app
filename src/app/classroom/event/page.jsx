import { Suspense } from "react";
import EventListClient from "./EventListClient";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  return (
    <Suspense fallback={null}>
      <EventListClient searchParams={searchParams || {}} />
    </Suspense>
  );
}
