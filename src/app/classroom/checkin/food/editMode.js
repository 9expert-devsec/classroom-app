// src/app/classroom/checkin/food/editMode.js
// K1b: one rule for "this food page is the edit-user edit" - used by page.jsx
// (StaffGate) and CheckinFoodClient (UI + `edit: true` in the save body).

function pick(sp, key) {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

export function isFoodEditMode(searchParams) {
  return (
    String(pick(searchParams, "edit") || "") === "1" ||
    String(pick(searchParams, "mode") || "") === "edit" ||
    String(pick(searchParams, "from") || "") === "edit-user"
  );
}
