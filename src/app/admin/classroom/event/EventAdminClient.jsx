"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function toLocalInput(dt) {
  // datetime-local expects "YYYY-MM-DDTHH:mm"
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function formatTH(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

async function fileToDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function EventAdminClient() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyUpload, setBusyUpload] = useState(false);
  const [err, setErr] = useState("");

  // form state
  const [editingId, setEditingId] = useState("");
  const isEditing = !!editingId;

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState(""); // datetime-local
  const [endAt, setEndAt] = useState(""); // datetime-local
  const [isActive, setIsActive] = useState(true);
  const [note, setNote] = useState("");

  const [coverUrl, setCoverUrl] = useState("");
  const [coverPid, setCoverPid] = useState("");
  const [prevCoverPid, setPrevCoverPid] = useState("");

  const formTitle = useMemo(
    () => (isEditing ? "แก้ไข Event" : "สร้าง Event"),
    [isEditing],
  );

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/events", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "load failed");
      setItems(data.items || []);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setEditingId("");
    setTitle("");
    setLocation("");
    setStartAt("");
    setEndAt("");
    setIsActive(true);
    setNote("");
    setCoverUrl("");
    setCoverPid("");
    setPrevCoverPid("");
    setErr("");
  }

  function startEdit(it) {
    setEditingId(it._id);
    setTitle(it.title || "");
    setLocation(it.location || "");
    setStartAt(toLocalInput(it.startAt));
    setEndAt(toLocalInput(it.endAt));
    setIsActive(it.isActive !== false);
    setNote(it.note || "");
    setCoverUrl(it.coverImageUrl || "");
    setCoverPid(it.coverImagePublicId || "");
    setPrevCoverPid(it.coverImagePublicId || "");
    setErr("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadCover(file) {
    if (!file) return;
    setErr("");
    setBusyUpload(true);
    try {
      const dataUrl = await fileToDataUrl(file);

      const res = await fetch("/api/admin/events/upload-cover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dataUrl,
          oldPublicId: coverPid || "", // replace รูปเดิม
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "upload failed");

      setCoverUrl(data.url || "");
      setCoverPid(data.publicId || "");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusyUpload(false);
    }
  }

  async function save() {
    setErr("");
    if (!title.trim()) {
      setErr("กรุณากรอกชื่อ Event");
      return;
    }
    if (!startAt) {
      setErr("กรุณาเลือกวัน/เวลาเริ่ม");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title,
        location,
        startAt: new Date(startAt).toISOString(),
        endAt: endAt ? new Date(endAt).toISOString() : null,
        isActive,
        note,
        coverImageUrl: coverUrl,
        coverImagePublicId: coverPid,
        prevCoverImagePublicId: prevCoverPid, // ให้ server ลบรูปเก่าถ้าถูกแทน/ถูกลบ
      };

      if (!isEditing) {
        const res = await fetch("/api/admin/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok)
          throw new Error(data?.error || "create failed");
        resetForm();
        await load();
        return;
      }

      const res = await fetch(`/api/admin/events/${editingId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "update failed");

      resetForm();
      await load();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function remove(id) {
    if (!confirm("ลบ Event นี้?")) return;
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "delete failed");
      if (editingId === id) resetForm();
      await load();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold">Event Management</div>
          <div className="mt-1 text-sm text-zinc-600">
            สร้าง/แก้ไข/ลบ Event และอัปโหลดภาพหน้าปก
          </div>
        </div>

        <button
          className="h-10 rounded-xl border px-4 text-sm font-semibold hover:bg-zinc-50"
          onClick={load}
          disabled={loading}
        >
          {loading ? "กำลังโหลด..." : "Refresh"}
        </button>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Form */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold">{formTitle}</div>
          {isEditing && (
            <button
              className="h-9 rounded-xl border px-3 text-sm font-semibold hover:bg-zinc-50"
              onClick={resetForm}
              disabled={loading}
            >
              ยกเลิกแก้ไข
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <div className="mb-1 font-medium text-zinc-700">ชื่อ Event</div>
            <input
              className="h-11 w-full rounded-xl border px-3 outline-none focus:ring-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น Next Skills Meetup"
            />
          </label>

          <label className="text-sm">
            <div className="mb-1 font-medium text-zinc-700">สถานที่</div>
            <input
              className="h-11 w-full rounded-xl border px-3 outline-none focus:ring-2"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="เช่น 9Expert HQ"
            />
          </label>

          <label className="text-sm">
            <div className="mb-1 font-medium text-zinc-700">วัน/เวลาเริ่ม</div>
            <input
              type="datetime-local"
              className="h-11 w-full rounded-xl border px-3 outline-none focus:ring-2"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </label>

          <label className="text-sm">
            <div className="mb-1 font-medium text-zinc-700">
              วัน/เวลาจบ (ไม่บังคับ)
            </div>
            <input
              type="datetime-local"
              className="h-11 w-full rounded-xl border px-3 outline-none focus:ring-2"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </label>

          <label className="text-sm sm:col-span-2">
            <div className="mb-1 font-medium text-zinc-700">หมายเหตุ</div>
            <textarea
              className="min-h-[88px] w-full rounded-xl border px-3 py-2 outline-none focus:ring-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="รายละเอียดเพิ่มเติม..."
            />
          </label>

          <div className="sm:col-span-2 flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span className="font-medium text-zinc-700">Active</span>
            </label>
          </div>

          {/* Cover */}
          <div className="sm:col-span-2 rounded-2xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">ภาพหน้าปก Event</div>

              <div className="flex items-center gap-2">
                <label
                  className={cx(
                    "h-9 cursor-pointer rounded-xl px-3 text-sm font-semibold",
                    busyUpload
                      ? "bg-zinc-200 text-zinc-500"
                      : "bg-black text-white",
                  )}
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={busyUpload}
                    onChange={(e) => uploadCover(e.target.files?.[0])}
                  />
                  {busyUpload ? "กำลังอัปโหลด..." : "อัปโหลดรูป"}
                </label>

                <button
                  className="h-9 rounded-xl border px-3 text-sm font-semibold hover:bg-zinc-50"
                  onClick={() => {
                    // เคลียร์รูป (ลบจริงจะเกิดตอนกด Save เพราะส่ง prevCoverPid)
                    setCoverUrl("");
                    setCoverPid("");
                  }}
                  disabled={busyUpload || (!coverUrl && !coverPid)}
                >
                  ลบรูป
                </button>
              </div>
            </div>

            <div className="mt-3">
              {coverUrl ? (
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-zinc-100">
                  <Image
                    src={coverUrl}
                    alt="cover"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 800px"
                  />
                </div>
              ) : (
                <div className="flex aspect-[16/9] w-full items-center justify-center rounded-xl bg-zinc-100 text-sm text-zinc-500">
                  ยังไม่มีรูป
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            className={cx(
              "h-11 flex-1 rounded-xl font-semibold",
              loading
                ? "bg-zinc-200 text-zinc-500"
                : "bg-emerald-600 text-white",
            )}
            onClick={save}
            disabled={loading || busyUpload}
          >
            {loading ? "กำลังบันทึก..." : isEditing ? "Update" : "Create"}
          </button>

          <button
            className="h-11 rounded-xl border px-4 font-semibold hover:bg-zinc-50"
            onClick={resetForm}
            disabled={loading || busyUpload}
          >
            Clear
          </button>
        </div>
      </div>

      {/* List */}
      <div className="mt-6 rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <div className="text-lg font-semibold">รายการ Event</div>
          <div className="mt-1 text-sm text-zinc-600">
            คลิก “แก้ไข” เพื่อโหลดขึ้นฟอร์มด้านบน
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-zinc-50">
              <tr className="text-left">
                <th className="px-4 py-3">Cover</th>
                <th className="px-4 py-3">ชื่อ</th>
                <th className="px-4 py-3">สถานที่</th>
                <th className="px-4 py-3">เริ่ม</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it._id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="relative h-12 w-20 overflow-hidden rounded-lg bg-zinc-100">
                      {it.coverImageUrl ? (
                        <Image
                          src={it.coverImageUrl}
                          alt={it.title}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      ) : null}
                    </div>
                  </td>

                  <td className="px-4 py-3 font-semibold">{it.title}</td>
                  <td className="px-4 py-3">{it.location || "-"}</td>
                  <td className="px-4 py-3">{formatTH(it.startAt)}</td>
                  <td className="px-4 py-3">
                    {it.isActive ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                        Off
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        className="h-9 rounded-xl border px-3 text-sm font-semibold hover:bg-zinc-50"
                        onClick={() => startEdit(it)}
                        disabled={loading}
                      >
                        แก้ไข
                      </button>

                      <button
                        className="h-9 rounded-xl bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700"
                        onClick={() => remove(it._id)}
                        disabled={loading}
                      >
                        ลบ
                      </button>

                      <button
                        className="h-9 rounded-xl border px-3 text-sm font-semibold hover:bg-zinc-50"
                        onClick={() =>
                          router.push(`/admin/classroom/event/${it._id}`)
                        }
                      >
                        Detail
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!items.length && (
                <tr>
                  <td
                    className="px-4 py-10 text-center text-zinc-500"
                    colSpan={6}
                  >
                    {loading ? "กำลังโหลด..." : "ยังไม่มี Event"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-xs text-zinc-500">
        * หมายเหตุ: ปุ่ม “ลบรูป” จะเคลียร์รูปในฟอร์ม และจะลบรูปจริงบน Cloudinary
        ตอนกด Save (ผ่าน prevCoverImagePublicId)
      </div>
    </div>
  );
}
