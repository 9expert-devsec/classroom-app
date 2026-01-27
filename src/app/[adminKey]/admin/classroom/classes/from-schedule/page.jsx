// src/app/admin/classroom/classes/from-schedule/page.jsx
import FromScheduleClient from "./FromScheduleClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return <FromScheduleClient />;
}