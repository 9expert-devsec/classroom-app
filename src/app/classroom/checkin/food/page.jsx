// src/app/classroom/checkin/food/page.jsx
import { Suspense } from "react";
import StaffGate from "@/app/classroom/StaffGate";
import CheckinFoodClient from "./CheckinFoodClient";
import { isFoodEditMode } from "./editMode";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  const sp = searchParams || {};
  const client = (
    <Suspense fallback={null}>
      <CheckinFoodClient searchParams={sp} />
    </Suspense>
  );

  // K1b: edit mode (from edit-user) is a staff tool - same gate as edit-user.
  // Normal check-in renders as before.
  return isFoodEditMode(sp) ? <StaffGate fill>{client}</StaffGate> : client;
}
