"use client";

import { useEffect, useMemo, useState } from "react";
import { centerCropToSquare } from "@/lib/imageCrop.client";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}
function clean(x) {
  return String(x || "").trim();
}

const ROLE_OPTIONS = [
  { value: "SA", label: "Super Admin" },
  { value: "OPS", label: "Staff / Ops" },
  { value: "EVT", label: "Event Specialist" },
];

async function apiJson(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    const msg = data?.error || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

const UI = {
  card: "rounded-3xl border border-admin-border/30 bg-white/70 shadow-sm",
  input:
    "w-full rounded-2xl border border-admin-border/30 bg-white/80 px-3 py-2 text-sm text-admin-text placeholder:text-admin-text/40 outline-none focus:ring-2 focus:ring-[#66ccff]/40",
  select:
    "w-full rounded-2xl border border-admin-border/30 bg-white/80 px-3 py-2 text-sm text-admin-text outline-none focus:ring-2 focus:ring-[#66ccff]/40",
  btnPrimary:
    "rounded-2xl px-4 py-2 text-sm font-medium bg-[#66ccff] text-black hover:bg-[#7ad6ff]",
  btnDisabled:
    "rounded-2xl px-4 py-2 text-sm font-medium bg-black/10 text-admin-text/40 cursor-not-allowed",
  btnGhost:
    "rounded-xl border border-admin-border/30 bg-white/70 px-3 py-1.5 text-xs text-admin-text hover:bg-white",
};

export default function UsersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    username: "",
    name: "",
    roleCode: "OPS",
    password: "",
  });

  async function load() {
    try {
      setErr("");
      setLoading(true);
      const data = await apiJson("/api/admin/users", { cache: "no-store" });
      setItems(data.items || []);
    } catch (e) {
      setErr(e.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createUser() {
    try {
      setCreating(true);
      setErr("");
      await apiJson("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: clean(form.username),
          name: clean(form.name),
          roleCode: form.roleCode,
          password: form.password,
        }),
      });
      setForm({ username: "", name: "", roleCode: "OPS", password: "" });
      await load();
    } catch (e) {
      setErr(e.message || "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function deleteUser(id) {
    if (!confirm("ลบผู้ใช้นี้แน่ใจไหม?")) return;
    try {
      setErr("");
      await apiJson(`/api/admin/users/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setErr(e.message || "Delete failed");
    }
  }

  async function toggleActive(it) {
    try {
      setErr("");
      await apiJson(`/api/admin/users/${it.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !it.isActive }),
      });
      await load();
    } catch (e) {
      setErr(e.message || "Update failed");
    }
  }

  async function resetPassword(it) {
    const pw = prompt("ตั้งรหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร):");
    if (!pw) return;
    try {
      setErr("");
      await apiJson(`/api/admin/users/${it.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      alert("เปลี่ยนรหัสผ่านแล้ว");
    } catch (e) {
      setErr(e.message || "Reset password failed");
    }
  }

  async function uploadAvatar(it, file) {
    try {
      setErr("");
      const blob = await centerCropToSquare(file, 512);
      const fd = new FormData();
      fd.append(
        "file",
        new File([blob], "avatar.jpg", { type: blob.type || "image/jpeg" }),
      );

      const up = await apiJson("/api/upload/admin-avatar", {
        method: "POST",
        body: fd,
      });

      await apiJson(`/api/admin/users/${it.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          avatarUrl: up.url,
          avatarPublicId: up.publicId,
        }),
      });

      await load();
    } catch (e) {
      setErr(e.message || "Upload avatar failed");
    }
  }

  const rows = useMemo(() => items || [], [items]);

  return (
    <div className="min-h-0 text-admin-text">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Accounts • Users</h1>
        <p className="text-sm text-admin-text/60">
          สร้าง/แก้ไข/ลบผู้ใช้ และกำหนด Role (SA/OPS/EVT)
        </p>
      </div>

      {err && (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Create */}
      <div className={cx("mb-6 p-4", UI.card)}>
        <div className="mb-3 text-sm font-semibold text-admin-text">
          Create User
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <input
            className={UI.input}
            placeholder="username"
            value={form.username}
            onChange={(e) =>
              setForm((s) => ({ ...s, username: e.target.value }))
            }
          />
          <input
            className={UI.input}
            placeholder="name (display)"
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          />
          <select
            className={UI.select}
            value={form.roleCode}
            onChange={(e) =>
              setForm((s) => ({ ...s, roleCode: e.target.value }))
            }
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label} ({r.value})
              </option>
            ))}
          </select>
          <input
            className={UI.input}
            placeholder="password (min 8 chars)"
            type="password"
            value={form.password}
            onChange={(e) =>
              setForm((s) => ({ ...s, password: e.target.value }))
            }
          />
        </div>

        <div className="mt-3">
          <button
            disabled={creating}
            onClick={createUser}
            className={creating ? UI.btnDisabled : UI.btnPrimary}
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>

      {/* List */}
      <div className={cx("p-4 min-h-0", UI.card)}>
        {loading ? (
          <div className="text-sm text-admin-text/60">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-admin-text/60">No users</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-admin-text/70">
                <tr className="text-left border-b border-admin-border/30">
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Last login</th>
                  <th className="py-2 pr-0 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((it) => (
                  <tr key={it.id} className="border-b border-admin-border/20">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-black/5 overflow-hidden border border-admin-border/20">
                          {it.avatarUrl ? (
                            <img
                              src={it.avatarUrl}
                              alt="avatar"
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full grid place-items-center text-xs text-admin-text/40">
                              —
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate text-admin-text">
                            {it.name || it.username}
                          </div>
                          <div className="text-xs text-admin-text/60 truncate">
                            {it.username}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 pr-3 font-medium">{it.roleCode}</td>

                    <td className="py-3 pr-3">
                      <span
                        className={cx(
                          "rounded-full px-2 py-1 text-xs font-medium",
                          it.isActive
                            ? "bg-emerald-500/15 text-emerald-700"
                            : "bg-black/5 text-admin-text/60",
                        )}
                      >
                        {it.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>

                    <td className="py-3 pr-3 text-xs text-admin-text/60">
                      {it.lastLoginAt
                        ? new Date(it.lastLoginAt).toLocaleString("th-TH")
                        : "-"}
                    </td>

                    <td className="py-3 pr-0">
                      <div className="flex items-center justify-end gap-2">
                        <label className={cx("cursor-pointer", UI.btnGhost)}>
                          Upload Avatar
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              uploadAvatar(it, f);
                              e.target.value = "";
                            }}
                          />
                        </label>

                        <button
                          onClick={() => resetPassword(it)}
                          className={UI.btnGhost}
                        >
                          Reset PW
                        </button>

                        <button
                          onClick={() => toggleActive(it)}
                          className={UI.btnGhost}
                        >
                          {it.isActive ? "Disable" : "Enable"}
                        </button>

                        <button
                          onClick={() => deleteUser(it.id)}
                          className="rounded-xl bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pt-3 text-xs text-admin-text/50">
              * แนะนำ: สร้าง OPS/EVT แล้วลอง logout/login
              เพื่อเช็คเมนูซ่อน/โชว์ตามสิทธิ์
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
