import { Suspense } from "react";
import MasterclassListClient from "./MasterclassListClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MasterclassListClient />
    </Suspense>
  );
}
