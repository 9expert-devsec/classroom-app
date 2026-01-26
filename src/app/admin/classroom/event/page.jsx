import EventListClient from "./EventListClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Page() {
  return <EventListClient />;
}
