"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

function formatTH(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

export default function EventListClient() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

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
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id) {
    if (!confirm("ลบ Event นี้?")) return;
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "delete failed");
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
          <div className="mt-1 text-sm text-zinc-600">รายการ Event ทั้งหมด</div>
        </div>

        <div className="flex gap-2">
          <button
            className="h-10 rounded-xl bg-black px-4 text-sm font-semibold text-white"
            onClick={() => router.push("/admin/classroom/event/new")}
          >
            + Create Event
          </button>

          <button
            className="h-10 rounded-xl border px-4 text-sm font-semibold hover:bg-zinc-50"
            onClick={load}
            disabled={loading}
          >
            {loading ? "กำลังโหลด..." : "Refresh"}
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
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
                        onClick={() =>
                          router.push(`/admin/classroom/event/${it._id}`)
                        }
                      >
                        Detail
                      </button>

                      <button
                        className="h-9 rounded-xl border px-3 text-sm font-semibold hover:bg-zinc-50"
                        onClick={() =>
                          router.push(`/admin/classroom/event/${it._id}/edit`)
                        }
                      >
                        Edit
                      </button>

                      <button
                        className="h-9 rounded-xl bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700"
                        onClick={() => remove(it._id)}
                        disabled={loading}
                      >
                        Delete
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
                    {loading
                      ? "กำลังโหลด..."
                      : "ยังไม่มี Event — กด Create Event เพื่อเริ่มสร้าง"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
