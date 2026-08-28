// src/app/[adminKey]/admin/classroom/masterclass/courses/page.jsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PrimaryButton from "@/components/ui/PrimaryButton";

const COURSE_ID_RE = /^[A-Z0-9-]{2,40}$/;

function normalizeCourseIdInput(v) {
  return String(v || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

function isHttpUrl(v) {
  const s = String(v || "").trim();
  return s.startsWith("http://") || s.startsWith("https://");
}

async function uploadImageFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || "อัปโหลดรูปไม่สำเร็จ");
  }
  return data.url;
}

export default function MasterclassCoursesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // ---- create form ----
  const [name, setName] = useState("");
  const [courseId, setCourseId] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  // ---- inline edit ----
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editCover, setEditCover] = useState("");
  const [editUploading, setEditUploading] = useState(false);
  const [savingId, setSavingId] = useState("");
  const editFileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/masterclass-courses", {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "โหลดรายการคอร์สไม่สำเร็จ");
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error(err);
      alert(err?.message || "โหลดรายการคอร์สไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCoverSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImageFile(file);
      setCoverImageUrl(url);
    } catch (err) {
      console.error(err);
      alert(err?.message || "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (submitting) return;

    const nm = name.trim();
    const cid = normalizeCourseIdInput(courseId);

    if (!nm) {
      alert("กรุณากรอกชื่อคอร์ส");
      return;
    }
    if (!COURSE_ID_RE.test(cid)) {
      alert("Course ID ใช้ได้เฉพาะ A-Z, 0-9 และ - ความยาว 2-40 ตัวอักษร");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/masterclass-courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nm,
          courseId: cid,
          coverImageUrl: coverImageUrl || "",
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        if (data?.error === "duplicate_course_id") {
          alert("Course ID นี้ถูกใช้ไปแล้ว: " + cid + " กรุณาใช้รหัสอื่น");
        } else {
          alert(data?.error || "สร้างคอร์สไม่สำเร็จ");
        }
        return;
      }

      setName("");
      setCourseId("");
      setCoverImageUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการเรียก API");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(row) {
    setEditingId(String(row._id));
    setEditName(row.name || "");
    setEditCover(row.coverImageUrl || "");
  }

  function cancelEdit() {
    setEditingId("");
    setEditName("");
    setEditCover("");
    if (editFileRef.current) editFileRef.current.value = "";
  }

  async function handleEditCoverSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }
    setEditUploading(true);
    try {
      const url = await uploadImageFile(file);
      setEditCover(url);
    } catch (err) {
      console.error(err);
      alert(err?.message || "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setEditUploading(false);
      if (editFileRef.current) editFileRef.current.value = "";
    }
  }

  async function patchCourse(id, payload) {
    const res = await fetch("/api/admin/masterclass-courses/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || "บันทึกไม่สำเร็จ");
    }
    return data.item;
  }

  async function handleSaveEdit(row) {
    const id = String(row._id);
    const nm = editName.trim();
    if (!nm) {
      alert("กรุณากรอกชื่อคอร์ส");
      return;
    }
    setSavingId(id);
    try {
      await patchCourse(id, { name: nm, coverImageUrl: editCover || "" });
      cancelEdit();
      await load();
    } catch (err) {
      console.error(err);
      alert(err?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSavingId("");
    }
  }

  async function handleToggleActive(row) {
    const id = String(row._id);
    setSavingId(id);
    try {
      await patchCourse(id, { isActive: !row.isActive });
      await load();
    } catch (err) {
      console.error(err);
      alert(err?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSavingId("");
    }
  }

  async function handleDelete(row) {
    const id = String(row._id);
    const label = row.courseId + " — " + row.name;
    if (!confirm("ลบคอร์ส " + label + " ใช่หรือไม่?")) return;

    setSavingId(id);
    try {
      const res = await fetch("/api/admin/masterclass-courses/" + id, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        if (data?.error === "course_in_use") {
          alert(
            "ลบไม่ได้ — ยังมี Class ที่ใช้คอร์สนี้อยู่ " +
              (data.classCount ?? 0) +
              " class\nกรุณาลบหรือย้าย Class เหล่านั้นก่อน",
          );
        } else {
          alert(data?.error || "ลบคอร์สไม่สำเร็จ");
        }
        return;
      }

      await load();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการเรียก API");
    } finally {
      setSavingId("");
    }
  }

  const previewSrc = isHttpUrl(coverImageUrl) ? coverImageUrl : "";

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col">
      <h1 className="text-2xl font-semibold">สร้างคอร์ส (Masterclass)</h1>
      <p className="mt-1 text-sm text-admin-textMuted">
        คอร์ส Masterclass เก็บแค่ชื่อคอร์ส, Course ID และรูป Cover
        แล้วนำไปใช้สร้าง Class ในหน้า New Class (Masterclass)
      </p>

      <div className="mt-6 flex-1 min-h-0 space-y-6 overflow-y-auto">
        {/* ---------- create form ---------- */}
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-3xl bg-admin-surface p-6 shadow-card"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-admin-text">
                ชื่อคอร์ส *
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น Masterclass: AI for Executives"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-admin-text">
                Course ID *
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-admin-border bg-white px-3 py-2 text-sm uppercase text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                value={courseId}
                onChange={(e) =>
                  setCourseId(normalizeCourseIdInput(e.target.value))
                }
                placeholder="เช่น MC-AI-EXEC"
              />
              <p className="mt-1 text-[11px] text-admin-textMuted">
                ใช้ได้เฉพาะ A-Z, 0-9 และ - (ความยาว 2-40 ตัวอักษร)
                — ระบบจะนำไปประกอบเป็นชื่อ Class จึงแก้ไม่ได้หลังสร้าง
              </p>
            </div>
          </div>

          {/* cover */}
          <div className="rounded-2xl border border-admin-border bg-white p-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-admin-text">
                Cover Course (ไม่บังคับ)
              </label>
              {coverImageUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setCoverImageUrl("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="rounded-full border border-admin-border bg-white px-3 py-1 text-xs text-admin-text hover:bg-admin-surfaceMuted"
                >
                  ลบรูป
                </button>
              )}
            </div>

            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-[11px] text-admin-textMuted">
                  อัปโหลดไฟล์
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverSelect}
                  disabled={uploading}
                  className="mt-1 w-full text-sm"
                />
                {uploading && (
                  <p className="mt-1 text-[11px] text-admin-textMuted">
                    กำลังอัปโหลด...
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[11px] text-admin-textMuted">
                  หรือวาง URL รูป
                </label>
                <input
                  type="text"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value.trim())}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                />
              </div>
            </div>

            {previewSrc && (
              <div className="mt-3 overflow-hidden rounded-xl border border-admin-border">
                <img
                  src={previewSrc}
                  alt="cover preview"
                  className="max-h-56 w-full object-cover"
                />
              </div>
            )}
          </div>

          <PrimaryButton type="submit" disabled={submitting || uploading}>
            {submitting ? "กำลังสร้างคอร์ส..." : "สร้างคอร์ส"}
          </PrimaryButton>
        </form>

        {/* ---------- existing courses ---------- */}
        <div className="rounded-3xl bg-admin-surface p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-admin-text">
              คอร์ส Masterclass ทั้งหมด
            </h2>
            <div className="text-xs text-admin-textMuted">
              {items.length} คอร์ส
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-admin-surfaceMuted text-[13px] uppercase text-admin-textMuted">
                <tr>
                  <th className="w-[110px] px-3 py-2 text-left">Cover</th>
                  <th className="w-[180px] px-3 py-2 text-left">Course ID</th>
                  <th className="px-3 py-2 text-left">ชื่อคอร์ส</th>
                  <th className="w-[110px] px-3 py-2 text-center">
                    จำนวน Class
                  </th>
                  <th className="w-[120px] px-3 py-2 text-center">สถานะ</th>
                  <th className="w-[170px] px-3 py-2 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-admin-textMuted"
                    >
                      กำลังโหลด...
                    </td>
                  </tr>
                )}

                {!loading && items.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-admin-textMuted"
                    >
                      ยังไม่มีคอร์ส Masterclass
                    </td>
                  </tr>
                )}

                {!loading &&
                  items.map((row) => {
                    const id = String(row._id);
                    const editing = editingId === id;
                    const busy = savingId === id;
                    const cover = editing ? editCover : row.coverImageUrl;

                    return (
                      <tr
                        key={id}
                        className="border-t border-admin-border align-top"
                      >
                        <td className="px-3 py-2">
                          {isHttpUrl(cover) ? (
                            <img
                              src={cover}
                              alt={row.courseId}
                              className="h-12 w-20 rounded-lg border border-admin-border object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-20 items-center justify-center rounded-lg border border-dashed border-admin-border text-[10px] text-admin-textMuted">
                              ไม่มีรูป
                            </div>
                          )}

                          {editing && (
                            <input
                              ref={editFileRef}
                              type="file"
                              accept="image/*"
                              onChange={handleEditCoverSelect}
                              disabled={editUploading}
                              className="mt-2 w-[160px] text-[11px]"
                            />
                          )}
                        </td>

                        <td className="px-3 py-2 font-medium text-admin-text">
                          {row.courseId}
                        </td>

                        <td className="px-3 py-2 text-admin-text">
                          {editing ? (
                            <input
                              className="w-full rounded-xl border border-admin-border bg-white px-3 py-1.5 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                          ) : (
                            row.name
                          )}
                        </td>

                        <td className="px-3 py-2 text-center text-admin-textMuted">
                          {row.classCount ?? 0}
                        </td>

                        <td className="px-3 py-2 text-center">
                          <label className="inline-flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={!!row.isActive}
                              disabled={busy}
                              onChange={() => handleToggleActive(row)}
                            />
                            <span className="text-xs text-admin-text">
                              {row.isActive ? "ใช้งาน" : "ปิด"}
                            </span>
                          </label>
                        </td>

                        <td className="px-3 py-2 text-right">
                          {editing ? (
                            <div className="inline-flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(row)}
                                disabled={busy || editUploading}
                                className="rounded-full border border-admin-border bg-white px-3 py-1 text-xs text-admin-text hover:bg-admin-surfaceMuted disabled:opacity-60"
                              >
                                {busy ? "กำลังบันทึก..." : "บันทึก"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="rounded-full border border-admin-border bg-white px-3 py-1 text-xs text-admin-textMuted hover:bg-admin-surfaceMuted"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(row)}
                                className="rounded-full border border-admin-border bg-white px-3 py-1 text-xs text-admin-text hover:bg-admin-surfaceMuted"
                              >
                                แก้ไข
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(row)}
                                disabled={busy}
                                className="rounded-full border border-admin-border bg-white px-3 py-1 text-xs text-red-600 hover:bg-admin-surfaceMuted disabled:opacity-60"
                              >
                                ลบ
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
