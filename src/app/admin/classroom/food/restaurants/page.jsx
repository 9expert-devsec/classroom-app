"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import TextInput from "@/components/ui/TextInput";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { MoreVertical } from "lucide-react";
import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

/* ---------- Modal เบาๆ ---------- */
function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="fixed inset-0 bg-black/40"
        onClick={onClose}
        aria-label="close overlay"
      />
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-base font-semibold text-admin-text">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-admin-surfaceMuted"
            aria-label="close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusBadge({ active = true }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700",
      ].join(" ")}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function VendorsPage() {
  const router = useRouter();

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");

  // modal + form
  const [openModal, setOpenModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [restName, setRestName] = useState("");
  const [restLogoUrl, setRestLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [openMenuId, setOpenMenuId] = useState(null);

  async function fetchRestaurants() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/food/restaurants", {
        cache: "no-store",
      });
      const data = await res.json();
      setRestaurants(data.items || []);
    } catch (err) {
      console.error(err);
      alert("โหลดรายการร้านอาหารไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRestaurants();
  }, []);

  /* ---------- upload ---------- */
  async function uploadImage(file) {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/admin/food/upload", {
      method: "POST",
      body: form,
    });

    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data?.error || "upload_failed");
    return data.url;
  }

  async function handleUploadLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      setRestLogoUrl(await uploadImage(file));
    } catch (err) {
      console.error(err);
      alert("อัพโหลดโลโก้ร้านไม่สำเร็จ");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  /* ---------- open/close modal ---------- */
  function openNew() {
    setEditingId(null);
    setRestName("");
    setRestLogoUrl("");
    setOpenModal(true);
  }

  function openEdit(r) {
    setEditingId(String(r._id));
    setRestName(r.name || "");
    setRestLogoUrl(r.logoUrl || "");
    setOpenModal(true);
  }

  function closeModal() {
    setOpenModal(false);
    setEditingId(null);
    setRestName("");
    setRestLogoUrl("");
  }

  /* ---------- save ---------- */
  async function handleSave(e) {
    e.preventDefault();
    if (!restName.trim()) return alert("กรุณากรอกชื่อร้านอาหาร");

    setSaving(true);
    try {
      const payload = {
        name: restName.trim(),
        logoUrl: restLogoUrl.trim() || null,
      };

      const url = editingId
        ? `/api/admin/food/restaurants/${editingId}`
        : "/api/admin/food/restaurants";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const out = await res.json();
      if (!res.ok) {
        console.error(out);
        return alert(out.error || "บันทึกร้านอาหารไม่สำเร็จ");
      }

      await fetchRestaurants();
      closeModal();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึกร้านอาหาร");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("ต้องการลบร้านอาหารนี้หรือไม่?")) return;
    try {
      const res = await fetch(`/api/admin/food/restaurants/${id}`, {
        method: "DELETE",
      });
      const out = await res.json();
      if (!res.ok) {
        console.error(out);
        return alert(out.error || "ลบร้านอาหารไม่สำเร็จ");
      }
      await fetchRestaurants();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการลบร้านอาหาร");
    }
  }

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return restaurants;
    return restaurants.filter((r) =>
      String(r.name || "")
        .toLowerCase()
        .includes(kw)
    );
  }, [restaurants, q]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">ร้านอาหาร</h1>
          <p className="text-sm text-admin-textMuted">
            เลือกร้านเพื่อจัดการ Menu Set และเมนูทั้งหมด
          </p>
        </div>

        <button
          type="button"
          onClick={openNew}
          className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Add
        </button>
      </div>

      {/* Search */}
      <div className="rounded-2xl bg-admin-surface p-4 shadow-slate-950/20">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <TextInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
            />
          </div>
          {loading && (
            <span className="text-xs text-admin-textMuted">กำลังโหลด...</span>
          )}
        </div>
      </div>

      {/* Grid cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((r) => {
          const active = r.isActive !== false; // ถ้าไม่มี field ก็ถือว่า active
          return (
            <div
              key={r._id}
              className="group rounded-2xl bg-admin-surface p-3 shadow-slate-950/20 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              {/* IMAGE (clickable) */}
              <div className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-admin-surfaceMuted">
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/admin/classroom/food/restaurants/${String(r._id)}`
                    )
                  }
                  className="absolute inset-0 z-0"
                  aria-label={`open ${r.name}`}
                />

                {r.logoUrl ? (
                  <Image
                    src={r.logoUrl}
                    alt={r.name || "vendor"}
                    fill
                    sizes="(max-width: 1024px) 50vw, 25vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-admin-textMuted">
                    No Image
                  </div>
                )}

                {/* ✅ kebab overlay อยู่ในกล่องรูป */}
                <div className="absolute right-2 top-2 z-10">
                  <DropdownMenu
                    open={openMenuId === r._id}
                    onOpenChange={(open) => setOpenMenuId(open ? r._id : null)}
                  >
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full
                       bg-white/85 text-admin-text shadow-md ring-1 ring-black/10
                       backdrop-blur hover:bg-white"
                        aria-label="เมนูการจัดการร้าน"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                      align="end"
                      sideOffset={8}
                      className="w-32 rounded-xl bg-white py-1 text-xs shadow-lg ring-1 ring-black/5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenuItem
                        onClick={() => {
                          setOpenMenuId(null);
                          openEdit(r);
                        }}
                      >
                        แก้ไข
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => {
                          setOpenMenuId(null);
                          handleDelete(r._id);
                        }}
                      >
                        ลบ
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* NAME (clickable) */}
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/admin/classroom/food/restaurants/${String(r._id)}`
                  )
                }
                className="w-full text-left"
              >
                <div className="truncate text-sm font-semibold text-admin-text">
                  {r.name}
                </div>
              </button>
            </div>
          );
        })}

        {!loading && filtered.length === 0 && (
          <div className="col-span-full rounded-2xl bg-admin-surface p-6 text-sm text-admin-textMuted shadow-slate-950/20">
            ไม่พบร้านอาหาร
          </div>
        )}
      </div>

      {/* Modal: Add/Edit vendor */}
      <Modal
        open={openModal}
        title={editingId ? "แก้ไขร้านอาหาร" : "เพิ่มร้านอาหาร"}
        onClose={closeModal}
      >
        <form onSubmit={handleSave} className="space-y-3">
          <label className="block text-sm">
            <span className="text-admin-text">ชื่อร้าน</span>
            <TextInput
              value={restName}
              onChange={(e) => setRestName(e.target.value)}
              placeholder="เช่น KFC"
            />
          </label>

          <label className="block text-sm">
            <span className="text-admin-text">โลโก้ร้าน (URL รูป)</span>
            <TextInput
              value={restLogoUrl}
              onChange={(e) => setRestLogoUrl(e.target.value)}
              placeholder="วางลิงก์รูป หรืออัพโหลด"
            />
          </label>

          <div className="flex items-center gap-3">
            <input
              id="vendorLogoFile"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUploadLogo}
            />
            <label
              htmlFor="vendorLogoFile"
              className="inline-flex cursor-pointer items-center rounded-lg border border-admin-border bg-white px-3 py-1.5 text-xs font-medium text-admin-text shadow-sm hover:bg-admin-surfaceMuted"
            >
              {uploading ? "กำลังอัพโหลด..." : "อัพโหลดรูปจากเครื่อง"}
            </label>
          </div>

          {restLogoUrl && (
            <div className="mt-1 inline-flex items-center gap-3 rounded-xl bg-admin-surfaceMuted px-3 py-2">
              <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-white/40">
                <Image
                  src={restLogoUrl}
                  alt={restName || "logo"}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </div>
              <span className="text-xs text-front-text">
                {restName || "ชื่อร้าน"}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-xl border border-admin-border bg-white px-3 py-2 text-sm hover:bg-admin-surfaceMuted"
            >
              ยกเลิก
            </button>
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "กำลังบันทึก..." : editingId ? "อัปเดต" : "บันทึก"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
