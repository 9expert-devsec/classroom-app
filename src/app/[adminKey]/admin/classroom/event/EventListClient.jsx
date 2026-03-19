"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

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
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xl font-semibold">Event Management</div>
          <div className="text-sm text-admin-textMuted">
            รายการ Event ทั้งหมด
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className="h-10 rounded-xl bg-brand-primary px-4 text-xs font-medium text-white shadow-sm transition hover:bg-brand-primaryDark hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/70"
            onClick={() =>
              router.push("/a1exqwvCqTXP7s0/admin/classroom/event/new")
            }
          >
            + Create Event
          </button>

          <button
            className="h-10 rounded-xl border px-4 text-xs font-medium hover:bg-zinc-50"
            onClick={load}
            disabled={loading}
          >
            {loading ? "กำลังโหลด..." : "Refresh"}
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shrink-0">
          {err}
        </div>
      )}

      <div className="flex flex-1 min-h-0 flex-col rounded-2xl bg-white p-4 shadow-card">
        <div className="flex-1 min-h-0">
        <div className="h-full w-full overflow-auto">
          <table className="w-full table-fixed text-base sm:text-sm">
            <thead className="sticky top-0 z-10 bg-admin-surfaceMuted text-[14px] uppercase text-admin-textMuted">
              <tr>
                <th className="w-[150px] px-3 py-2 text-center">Cover</th>
                <th className="px-3 py-2 text-left">ชื่อ</th>
                <th className="w-[200px] px-3 py-2 text-center">สถานที่</th>
                <th className="w-[180px] px-3 py-2 text-center">เริ่ม</th>
                <th className="w-[110px] px-3 py-2 text-center">สถานะ</th>
                <th className="w-[100px] px-3 py-2 text-right">จัดการ</th>
              </tr>
            </thead>

            <tbody>
              {items.map((it) => (
                <tr key={it._id} className="border-t border-admin-border hover:bg-admin-surfaceMuted/60">
                  <td className="px-3 py-2">
                    <div className="flex justify-center">
                    <div className="relative h-16 w-full overflow-hidden rounded-lg bg-zinc-100">
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
                    </div>
                  </td>

                  <td className="px-3 py-2 font-semibold">{it.title}</td>
                  <td className="px-3 py-2">{it.location || "-"}</td>
                  <td className="px-3 py-2 text-center">
                    {formatTH(it.startAt)}
                  </td>

                  <td className="px-3 py-2 text-center">
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

                  <td className="px-3 py-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full
                          border border-admin-border bg-white text-admin-text
                          hover:bg-admin-surfaceMuted focus:outline-none"
                          aria-label="เมนูการจัดการ"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent
                        align="end"
                        sideOffset={8}
                        className="w-32 rounded-xl bg-white py-1 text-xs shadow-lg ring-1 ring-black/5"
                      >
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/a1exqwvCqTXP7s0/admin/classroom/event/${it._id}`}
                          >
                            เปิดดู
                          </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem asChild>
                          <Link
                            href={`/a1exqwvCqTXP7s0/admin/classroom/event/${it._id}/edit`}
                          >
                            แก้ไข
                          </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem onSelect={() => remove(it._id)}>
                          ลบ
                        </DropdownMenuItem>

                      </DropdownMenuContent>
                    </DropdownMenu>
                    {/* <div className="inline-flex gap-2">
                      <button
                        className="h-9 rounded-xl border px-3 text-sm font-semibold hover:bg-zinc-50"
                        onClick={() =>
                          router.push(`/a1exqwvCqTXP7s0/admin/classroom/event/${it._id}`)
                        }
                      >
                        Detail
                      </button>

                      <button
                        className="h-9 rounded-xl border px-3 text-sm font-semibold hover:bg-zinc-50"
                        onClick={() =>
                          router.push(`/a1exqwvCqTXP7s0/admin/classroom/event/${it._id}/edit`)
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
                    </div> */}
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
    </div>
  );
}
