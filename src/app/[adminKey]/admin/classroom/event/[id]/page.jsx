import EventDetailAdminClient from "./EventDetailAdminClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Page({ params }) {
  const id = String(params?.id || "");
  return <EventDetailAdminClient eventId={id} />;
}
