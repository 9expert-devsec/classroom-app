"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function formatTH(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

function clean(s) {
  return String(s || "").trim();
}

const STATUS_FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "checkedIn", label: "เช็คอินแล้ว" },
  { key: "notChecked", label: "ยังไม่เช็คอิน" },
  { key: "cancelled", label: "ยกเลิก" },
];

export default function EventDetailAdminClient({ eventId }) {
  const router = useRouter();

  const [event, setEvent] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // modal (signature)
  const [sigOpen, setSigOpen] = useState(false);
  const [sigUrl, setSigUrl] = useState("");

  // edit/create form
  const [editingId, setEditingId] = useState(""); // "" => create
  const isEditing = !!editingId;

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sourceChannel, setSourceChannel] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [workStatus, setWorkStatus] = useState("");
  const [attStatus, setAttStatus] = useState("registered"); // registered|cancelled
  const [note, setNote] = useState("");

  const stats = useMemo(() => {
    const total = items.length;
    const cancelled = items.filter((x) => x.status === "cancelled").length;
    const checked = items.filter(
      (x) => !!x.checkedInAt && x.status !== "cancelled",
    ).length;
    const not = items.filter(
      (x) => !x.checkedInAt && x.status !== "cancelled",
    ).length;
    return { total, checked, not, cancelled };
  }, [items]);

  async function load() {
    if (!eventId) return;
    setErr("");
    setLoading(true);
    try {
      // event info
      const eRes = await fetch(`/api/admin/events/${eventId}`, {
        cache: "no-store",
      });
      const eData = await eRes.json();
      if (!eRes.ok || !eData?.ok)
        throw new Error(eData?.error || "load event failed");
      setEvent(eData.item || null);

      // attendees
      const url = new URL(
        `/api/admin/events/${eventId}/attendees`,
        window.location.origin,
      );
      if (clean(search)) url.searchParams.set("q", clean(search));
      if (statusFilter && statusFilter !== "all")
        url.searchParams.set("status", statusFilter);

      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok)
        throw new Error(data?.error || "load attendees failed");

      setItems(data.items || []);
    } catch (e) {
      setErr(String(e?.message || e));
      setItems([]);
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // reload when filter/search change (debounce เบา ๆ)
  useEffect(() => {
    const t = setTimeout(() => load(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  function resetForm() {
    setEditingId("");
    setFullName("");
    setPhone("");
    setEmail("");
    setSourceChannel("");
    setGender("");
    setAge("");
    setWorkStatus("");
    setAttStatus("registered");
    setNote("");
  }

  function startEdit(it) {
    setEditingId(it._id);
    setFullName(it.fullName || "");
    setPhone(it.phone || "");
    setEmail(it.email || "");
    setSourceChannel(it.sourceChannel || "");
    setGender(it.gender || "");
    setAge(it.age == null ? "" : String(it.age));
    setWorkStatus(it.workStatus || "");
    setAttStatus(it.status || "registered");
    setNote(it.note || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    setErr("");
    if (!clean(fullName)) {
      setErr("กรุณากรอกชื่อ-นามสกุล");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        fullName: clean(fullName),
        phone: clean(phone),
        email: clean(email),
        sourceChannel: clean(sourceChannel),
        gender: clean(gender),
        age: clean(age) ? Number(age) : null,
        workStatus: clean(workStatus),
        status: attStatus === "cancelled" ? "cancelled" : "registered",
        note: clean(note),
      };

      if (!isEditing) {
        const res = await fetch(`/api/admin/events/${eventId}/attendees`, {
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

      const res = await fetch(
        `/api/admin/events/${eventId}/attendees/${editingId}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
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

  async function remove(attId) {
    if (!confirm("ลบผู้เข้าร่วมคนนี้?")) return;
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/events/${eventId}/attendees/${attId}`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "delete failed");
      if (editingId === attId) resetForm();
      await load();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  function openSignature(url) {
    if (!url) return;
    setSigUrl(url);
    setSigOpen(true);
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold">Event Detail</div>
          <div className="mt-1 text-sm text-zinc-600">
            จัดการผู้เข้าร่วม และตรวจสอบสถานะการเช็คอิน/ลายเซ็น
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className="h-10 rounded-xl border px-4 text-sm font-semibold hover:bg-zinc-50"
            onClick={() => router.push("/a1exqwvCqTXP7s0/admin/classroom/event")}
            disabled={loading}
          >
            กลับหน้า Event
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

      {/* Event Info */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-zinc-100 sm:w-[320px]">
            {event?.coverImageUrl ? (
              <Image
                src={event.coverImageUrl}
                alt={event.title || "event"}
                fill
                className="object-cover"
                sizes="320px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
                No Cover
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="text-lg font-semibold">{event?.title || "-"}</div>
            <div className="mt-1 text-sm text-zinc-600">
              สถานที่: {event?.location || "-"}
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              เริ่ม: {formatTH(event?.startAt)}
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              จบ: {formatTH(event?.endAt)}
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              สถานะ:{" "}
              {event?.isActive ? (
                <span className="font-semibold text-emerald-700">Active</span>
              ) : (
                <span className="font-semibold text-zinc-600">Off</span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard label="ทั้งหมด" value={stats.total} />
              <StatCard label="เช็คอินแล้ว" value={stats.checked} />
              <StatCard label="ยังไม่เช็คอิน" value={stats.not} />
              <StatCard label="ยกเลิก" value={stats.cancelled} />
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit attendee */}
      <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold">
            {isEditing ? "แก้ไขผู้เข้าร่วม" : "เพิ่มผู้เข้าร่วม"}
          </div>
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
          <Field
            label="ชื่อ-นามสกุล"
            value={fullName}
            onChange={setFullName}
            placeholder="Full name"
          />
          <Field
            label="เบอร์โทร"
            value={phone}
            onChange={setPhone}
            placeholder="Phone"
          />

          <Field
            label="อีเมล"
            value={email}
            onChange={setEmail}
            placeholder="Email"
          />
          <Field
            label="ช่องที่ทราบข่าว"
            value={sourceChannel}
            onChange={setSourceChannel}
            placeholder="Facebook / Line / ..."
          />

          <Field
            label="เพศ"
            value={gender}
            onChange={setGender}
            placeholder="Male / Female / ..."
          />
          <Field
            label="อายุ"
            value={age}
            onChange={setAge}
            placeholder="เช่น 29"
          />

          <Field
            label="สถานภาพการทำงาน"
            value={workStatus}
            onChange={setWorkStatus}
            placeholder="Employed / Student / ..."
          />

          <label className="text-sm">
            <div className="mb-1 font-medium text-zinc-700">
              สถานะผู้เข้าร่วม
            </div>
            <select
              className="h-11 w-full rounded-xl border px-3 outline-none focus:ring-2"
              value={attStatus}
              onChange={(e) => setAttStatus(e.target.value)}
            >
              <option value="registered">ผู้เข้าร่วม</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
          </label>

          <label className="text-sm sm:col-span-2">
            <div className="mb-1 font-medium text-zinc-700">หมายเหตุ</div>
            <textarea
              className="min-h-[88px] w-full rounded-xl border px-3 py-2 outline-none focus:ring-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note..."
            />
          </label>
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
            disabled={loading}
          >
            {loading ? "กำลังบันทึก..." : isEditing ? "Update" : "Create"}
          </button>

          <button
            className="h-11 rounded-xl border px-4 font-semibold hover:bg-zinc-50"
            onClick={resetForm}
            disabled={loading}
          >
            Clear
          </button>
        </div>
      </div>

      {/* filters */}
      <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-lg font-semibold">รายชื่อผู้เข้าร่วม</div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2 sm:w-[280px]"
              placeholder="ค้นหา ชื่อ/เบอร์/อีเมล"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="h-10 rounded-xl border px-3 text-sm outline-none focus:ring-2"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_FILTERS.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-zinc-50">
              <tr className="text-left">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">ชื่อ-นามสกุล</th>
                <th className="px-4 py-3">เบอร์</th>
                <th className="px-4 py-3">อีเมล</th>
                <th className="px-4 py-3">ช่องทาง</th>
                <th className="px-4 py-3">เพศ/อายุ</th>
                <th className="px-4 py-3">สถานภาพ</th>
                <th className="px-4 py-3">เช็คอิน</th>
                <th className="px-4 py-3">ลายเซ็น</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {items.map((it, idx) => {
                const cancelled = it.status === "cancelled";
                const checked = !!it.checkedInAt;

                return (
                  <tr key={it._id} className="border-t">
                    <td className="px-4 py-3">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{it.fullName}</div>
                      {cancelled ? (
                        <div className="mt-1 text-xs font-semibold text-red-600">
                          ยกเลิก
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{it.phone || "-"}</td>
                    <td className="px-4 py-3">{it.email || "-"}</td>
                    <td className="px-4 py-3">{it.sourceChannel || "-"}</td>
                    <td className="px-4 py-3">
                      {(it.gender || "-") + " / " + (it.age ?? "-")}
                    </td>
                    <td className="px-4 py-3">{it.workStatus || "-"}</td>

                    <td className="px-4 py-3">
                      {cancelled ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                          -
                        </span>
                      ) : checked ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                          {formatTH(it.checkedInAt)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                          ยังไม่เช็คอิน
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {it.signatureUrl ? (
                        <button
                          className="h-9 rounded-xl border px-3 text-xs font-semibold hover:bg-zinc-50"
                          onClick={() => openSignature(it.signatureUrl)}
                        >
                          ดูลายเซ็น
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-500">-</span>
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
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!items.length && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-zinc-500"
                  >
                    {loading ? "กำลังโหลด..." : "ยังไม่มีรายชื่อ"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signature Modal */}
      {sigOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSigOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">ลายเซ็น</div>
              <button
                className="h-9 rounded-xl border px-3 text-sm font-semibold hover:bg-zinc-50"
                onClick={() => setSigOpen(false)}
              >
                ปิด
              </button>
            </div>

            <div className="mt-3 relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-zinc-100">
              {sigUrl ? (
                <Image
                  src={sigUrl}
                  alt="signature"
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 800px"
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-extrabold">{value}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="text-sm">
      <div className="mb-1 font-medium text-zinc-700">{label}</div>
      <input
        className="h-11 w-full rounded-xl border px-3 outline-none focus:ring-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || ""}
      />
    </label>
  );
}
