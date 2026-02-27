"use client";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

export default function RolesPage() {
  const card =
    "rounded-3xl border border-admin-border/30 bg-white/70 p-4 shadow-sm";

  const rows = [
    ["Dashboard", "Full", "View", "View"],
    ["Classes", "Manage", "Manage", "View"],
    ["Food Menu", "Manage", "Manage", "None"],
    ["Events (General)", "Manage", "Add/Import/Check-in", "Manage"],
    ["Events (Settings)", "Edit/Delete", "View", "Edit/Delete"],
    ["Accounts", "Manage", "None", "None"],
    ["My Account", "Edit own", "Edit own", "Edit own"],
  ];

  return (
    <div className="text-admin-text">
      <h1 className="text-2xl font-semibold mb-2">
        Accounts • Roles & Permissions
      </h1>

      <div className={card}>
        <div className="mb-3">
          <div className="text-sm font-semibold">Role Codes</div>
          <div className="mt-2 grid gap-1 text-sm text-admin-text/80">
            <div>
              <span className="font-semibold">SA</span> = Super Admin
            </div>
            <div>
              <span className="font-semibold">OPS</span> = Staff / Ops
            </div>
            <div>
              <span className="font-semibold">EVT</span> = Event Specialist
            </div>
          </div>
        </div>

        <div className="mt-4 mb-2 text-sm font-semibold">Matrix</div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-admin-text/70">
              <tr className="border-b border-admin-border/30 text-left">
                <th className="py-2 pr-3">Module</th>
                <th className="py-2 pr-3">SA</th>
                <th className="py-2 pr-3">OPS</th>
                <th className="py-2 pr-0">EVT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r[0]} className="border-b border-admin-border/20">
                  <td className="py-3 pr-3 font-medium">{r[0]}</td>
                  <td className="py-3 pr-3">{r[1]}</td>
                  <td className="py-3 pr-3">{r[2]}</td>
                  <td className="py-3 pr-0">{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-admin-text/55">
          * สิทธิ์จริงควบคุมด้วย <code>src/lib/acl.js</code> + server guard{" "}
          <code>requirePerm()</code>
        </div>
      </div>
    </div>
  );
}
