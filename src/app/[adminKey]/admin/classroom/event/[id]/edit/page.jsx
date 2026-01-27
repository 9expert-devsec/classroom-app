import EventUpsertClient from "../../shared/EventUpsertClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Page({ params }) {
  const id = String(params?.id || "");
  return <EventUpsertClient mode="edit" eventId={id} />;
}
