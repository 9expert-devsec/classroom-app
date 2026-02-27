"use client";

import { useEffect, useState } from "react";
import { centerCropToSquare } from "@/lib/imageCrop.client";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

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
  card: "rounded-3xl border border-admin-border/30 bg-white/70 p-4 shadow-sm max-w-2xl",
  input:
    "w-full rounded-2xl border border-admin-border/30 bg-white/80 px-3 py-2 text-sm text-admin-text placeholder:text-admin-text/40 outline-none focus:ring-2 focus:ring-[#66ccff]/40",
  btnPrimary:
    "rounded-2xl px-4 py-2 text-sm font-medium bg-[#66ccff] text-black hover:bg-[#7ad6ff]",
  btnDisabled:
    "rounded-2xl px-4 py-2 text-sm font-medium bg-black/10 text-admin-text/40 cursor-not-allowed",
  btnGhost:
    "rounded-2xl border border-admin-border/30 bg-white/70 px-3 py-2 text-sm text-admin-text hover:bg-white",
};

export default function MyAccountPage() {
  const [me, setMe] = useState(null);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  async function load() {
    try {
      setErr("");
      const data = await apiJson("/api/admin/me", { cache: "no-store" });
      setMe(data.user);
      setName(data.user?.name || "");
    } catch (e) {
      setErr(e.message || "Load failed");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    try {
      setSaving(true);
      setErr("");

      const payload = { name };

      // ✅ ส่งเฉพาะเมื่อกรอกสักช่องหนึ่ง
      if (currentPassword || newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      await apiJson("/api/admin/me", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      setCurrentPassword("");
      setNewPassword("");
      await load();
    } catch (e) {
      setErr(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file) {
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

      await apiJson("/api/admin/me", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          avatarUrl: up.url,
          avatarPublicId: up.publicId,
        }),
      });

      await load();
    } catch (e) {
      setErr(e.message || "Upload failed");
    }
  }

  return (
    <div className="text-admin-text">
      <h1 className="text-2xl font-semibold mb-2">My Account</h1>

      {err && (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {!me ? (
        <div className="text-sm text-admin-text/60">Loading...</div>
      ) : (
        <div className={UI.card}>
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-black/5 overflow-hidden border border-admin-border/20">
              {me.avatarUrl ? (
                <img
                  src={me.avatarUrl}
                  alt="avatar"
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <div className="h-14 w-14 grid place-items-center text-xs text-admin-text/40">
                  —
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="text-xs text-admin-text/60">Username</div>
              <div className="font-semibold truncate">{me.username}</div>
              <div className="text-xs text-admin-text/60">
                Role: <span className="font-medium">{me.roleCode}</span>
              </div>
            </div>

            <label className={cx("ml-auto cursor-pointer", UI.btnGhost)}>
              Upload Avatar
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  uploadAvatar(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          <div className="mt-5 grid gap-4">
            <div>
              <div className="text-sm font-semibold mb-1">Display name</div>
              <input
                className={UI.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="border-t border-admin-border/30 pt-4">
              <div className="text-sm font-semibold mb-2">Change password</div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  name="currentPassword"
                  autoComplete="current-password"
                  className={UI.input}
                  placeholder="Current password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <input
                  name="newPassword"
                  autoComplete="new-password"
                  className={UI.input}
                  placeholder="New password (min 8 chars)"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="mt-3">
                <button
                  onClick={save}
                  disabled={saving}
                  className={saving ? UI.btnDisabled : UI.btnPrimary}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>

              <div className="mt-2 text-xs text-admin-text/55">
                * ถ้าไม่ได้เปลี่ยนรหัสผ่าน ให้ปล่อยช่อง password ว่างไว้ได้
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
