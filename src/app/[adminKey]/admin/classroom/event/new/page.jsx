import EventUpsertClient from "../shared/EventUpsertClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Page() {
  return <EventUpsertClient mode="create" />;
}
