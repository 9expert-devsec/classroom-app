"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function toLocalInput(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

async function fileToDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function EventUpsertClient({ mode = "create", eventId = "" }) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [loading, setLoading] = useState(false);
  const [busyUpload, setBusyUpload] = useState(false);
  const [err, setErr] = useState("");

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [note, setNote] = useState("");

  const [coverUrl, setCoverUrl] = useState("");
  const [coverPid, setCoverPid] = useState("");
  const [prevCoverPid, setPrevCoverPid] = useState("");

  useEffect(() => {
    if (!isEdit) return;

    async function loadOne() {
      setErr("");
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/events/${eventId}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) throw new Error(data?.error || "load failed");

        const it = data.item || {};
        setTitle(it.title || "");
        setLocation(it.location || "");
        setStartAt(toLocalInput(it.startAt));
        setEndAt(toLocalInput(it.endAt));
        setIsActive(it.isActive !== false);
        setNote(it.note || "");
        setCoverUrl(it.coverImageUrl || "");
        setCoverPid(it.coverImagePublicId || "");
        setPrevCoverPid(it.coverImagePublicId || "");
      } catch (e) {
        setErr(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    }

    if (eventId) loadOne();
  }, [isEdit, eventId]);

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
          oldPublicId: coverPid || "",
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
    if (!title.trim()) return setErr("กรุณากรอกชื่อ Event");
    if (!startAt) return setErr("กรุณาเลือกวัน/เวลาเริ่ม");

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
        prevCoverImagePublicId: prevCoverPid,
      };

      if (!isEdit) {
        const res = await fetch("/api/admin/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok)
          throw new Error(data?.error || "create failed");
        router.push("/a1exqwvCqTXP7s0/admin/classroom/event");
        return;
      }

      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "update failed");
      router.push("/a1exqwvCqTXP7s0/admin/classroom/event");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-row gap-3 items-center">
        <button
          type="button"
          onClick={() =>
            router.replace("/a1exqwvCqTXP7s0/admin/classroom/event")
          }
          className="inline-flex h-9 w-9 items-center justify-center rounded-full
               border border-admin-border bg-white text-admin-text
               hover:bg-admin-surfaceMuted"
          aria-label="ย้อนกลับ"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div>
          <div className="text-xl font-extrabold">
            {isEdit ? "Edit Event" : "Create Event"}
          </div>
          <div className="text-sm text-zinc-600">
            สร้าง/แก้ไข Event และอัปโหลดภาพหน้าปก
          </div>
        </div>

        {/* <button
          className="h-10 rounded-xl border px-4 text-sm font-normal hover:bg-zinc-50"
          onClick={() => router.push("/a1exqwvCqTXP7s0/admin/classroom/event")}
          disabled={loading}
        >
          กลับหน้า List
        </button> */}
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-5 shadow-sm overflow-y-auto">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

          <div className="sm:col-span-2 rounded-2xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">ภาพหน้าปก Event</div>

              <div className="flex items-center gap-2">
                <label
                  className={cx(
                    "inline-flex h-10 cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-semibold transition",
                    busyUpload
                      ? "bg-zinc-200 text-zinc-500"
                      : "bg-admin-text text-white hover:opacity-90",
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
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-admin-border px-4 text-sm font-medium text-admin-text transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => {
                    setCoverUrl("");
                    setCoverPid("");
                  }}
                  disabled={busyUpload || (!coverUrl && !coverPid)}
                >
                  ลบรูป
                </button>
              </div>
            </div>

            <div className="mt-4">
              {coverUrl ? (
                <div className="relative aspect-[16/9] w-full max-w-[820px] overflow-hidden rounded-2xl border border-admin-border/60 bg-zinc-100">
                  <Image
                    src={coverUrl}
                    alt="cover"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 820px"
                  />
                </div>
              ) : (
                <div className="flex aspect-[16/9] w-2/4 items-center justify-center rounded-xl bg-zinc-100 text-sm text-zinc-500">
                  ยังไม่มีรูป
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t pt-4">
          <button
            className="h-10 rounded-xl border px-5 text-sm font-normal text-slate-500 hover:bg-zinc-50"
            onClick={() =>
              router.push("/a1exqwvCqTXP7s0/admin/classroom/event")
            }
            disabled={loading}
          >
            Cancel
          </button>

          <button
            className={cx(
              "h-10 min-w-[140px] rounded-xl px-5 font-semibold",
              loading
                ? "bg-zinc-200 text-zinc-500"
                : "bg-[#66ccff] text-[#0A1F33] hover:bg-[#51a8d3] hover:text-white",
            )}
            onClick={save}
            disabled={loading || busyUpload}
          >
            {loading ? "กำลังบันทึก..." : isEdit ? "Update" : "Create"}
          </button>
        </div>

        {/* <div className="mt-4 flex gap-2">
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
            {loading ? "กำลังบันทึก..." : isEdit ? "Update" : "Create"}
          </button>

          <button
            className="h-11 rounded-xl border px-4 font-semibold hover:bg-zinc-50"
            onClick={() =>
              router.push("/a1exqwvCqTXP7s0/admin/classroom/event")
            }
            disabled={loading}
          >
            Cancel
          </button>
        </div> */}
      </div>

      {/* <div className="mt-4 text-xs text-zinc-500">
        * “ลบรูป” จะเคลียร์รูปในฟอร์ม และลบรูปจริงบน Cloudinary ตอนกด Save (ผ่าน
        prevCoverImagePublicId)
      </div> */}
    </div>
  );
}
