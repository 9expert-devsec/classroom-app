// src/app/classroom/receive/staff/layout.jsx
// L2b: staff tool - content only after the staff step-up (StaffGate).
// A layout (not the page) so the gate stays mounted while moving between
// pages of this tool.
import StaffGate from "@/app/classroom/StaffGate";

export default function StaffToolLayout({ children }) {
  return <StaffGate>{children}</StaffGate>;
}
