// src/app/admin/classroom/ClassroomDashboardClient.jsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function fmtTime(t) {
  if (!t) return "-";
  return new Date(t).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isHttpUrl(x) {
  return /^https?:\/\//i.test(String(x || "").trim());
}

function IconBubble({ icon, classCode, title, programIconUrl }) {
  // ✅ เอา url เฉพาะกรณีที่เป็น http(s) เท่านั้น
  const iconUrlFromIcon =
    icon?.type === "url"
      ? icon?.value || icon?.url || icon?.src || ""
      : typeof icon === "string"
      ? icon
      : "";

  const candidate = String(programIconUrl || iconUrlFromIcon || "").trim();
  const url = isHttpUrl(candidate) ? candidate : "";

  if (url) {
    return (
      <div className="h-10 w-10 overflow-hidden rounded-xl border border-admin-border bg-white">
        <img alt="" src={url} className="h-full w-full object-cover" />
      </div>
    );
  }

  if (icon?.type === "emoji" && icon?.value) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-admin-border bg-admin-surfaceMuted text-lg">
        {icon.value}
      </div>
    );
  }

  const ch = String(classCode || title || "?")
    .trim()
    .slice(0, 1)
    .toUpperCase();

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-admin-border bg-admin-surfaceMuted text-sm font-bold">
      {ch}
    </div>
  );
}

function StatCard({ active, label, value, sub, onClick, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-2xl p-4 shadow-card text-left border transition",
        active
          ? "border-brand-primary ring-2 ring-brand-primary/20 bg-admin-surface"
          : "border-admin-border bg-admin-surface hover:bg-admin-surfaceMuted"
      )}
    >
      <p className="text-xs text-admin-textMuted">{label}</p>
      <p
        className={cx(
          "mt-2 text-2xl font-semibold",
          tone === "danger" ? "text-brand-danger" : ""
        )}
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-1 text-[11px] text-admin-textMuted">{sub}</p>
      ) : null}
    </button>
  );
}

function ModeLabel(active) {
  return active === "classes"
    ? "จำนวนคลาส"
    : active === "students"
    ? "จำนวนนักเรียน"
    : active === "checkins"
    ? "จำนวนเช็คอิน"
    : active === "late"
    ? "เช็คอินสาย"
    : "ไม่มาเช็คอิน";
}

function filterItemsByMode(items, mode) {
  const list = Array.isArray(items) ? items : [];
  if (mode === "students") return list;
  if (mode === "checkins") return list.filter((x) => !!x.checkinTime);
  if (mode === "late") return list.filter((x) => !!x.checkinTime && x.isLate);
  if (mode === "absent") return list.filter((x) => !x.checkinTime);
  return list;
}

function GroupedStudentTable({ groups, mode }) {
  const safeGroups = Array.isArray(groups) ? groups : [];

  const sortedGroups = safeGroups.slice().sort((a, b) => {
    const ai = filterItemsByMode(a?.items, mode).length;
    const bi = filterItemsByMode(b?.items, mode).length;
    return bi - ai;
  });

  return (
    <div className="mt-4 space-y-4">
      {sortedGroups.map((g) => {
        const items = filterItemsByMode(g?.items, mode);
        const totalInClass = Array.isArray(g?.items) ? g.items.length : 0;

        return (
          <div
            key={g.classId}
            className="rounded-2xl border border-admin-border bg-admin-surface p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <IconBubble
                  icon={g.icon}
                  classCode={g.courseCode}
                  title={g.title}
                  programIconUrl={g.programIconUrl}
                />
                <div className="flex flex-col">
                  <div className="font-semibold">
                    {g.courseCode ? `${g.courseCode} – ` : ""}
                    {g.title}
                  </div>
                  <div className="text-[11px] text-admin-textMuted">
                    ห้อง {g.room || "-"}
                    {g.programName ? ` • Program: ${g.programName}` : ""}
                  </div>
                </div>
              </div>

              <div className="text-right text-[11px] text-admin-textMuted">
                <div>
                  แสดง:{" "}
                  <span className="font-semibold text-admin-text">
                    {items.length}
                  </span>{" "}
                  รายการ
                </div>
                <div>ผู้เรียนทั้งหมด {totalInClass} คน</div>
              </div>
            </div>

            {!items.length ? (
              <div className="mt-3 rounded-xl border border-admin-border bg-admin-surfaceMuted px-3 py-3 text-sm text-admin-textMuted">
                ไม่มีข้อมูลในโหมดนี้สำหรับคลาสนี้
              </div>
            ) : (
              <div className="mt-3 overflow-hidden rounded-xl border border-admin-border">
                <table className="w-full text-sm">
                  <thead className="bg-admin-surfaceMuted text-admin-textMuted">
                    <tr>
                      <th className="w-14 px-3 py-2 text-left font-medium">
                        #
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        ชื่อผู้เรียน
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        บริษัท
                      </th>
                      <th className="w-32 px-3 py-2 text-left font-medium">
                        เวลาเช็คอิน
                      </th>
                      <th className="w-28 px-3 py-2 text-left font-medium">
                        สถานะ
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((x, idx) => (
                      <tr
                        key={x.id}
                        className={cx(
                          "border-t border-admin-border",
                          idx % 2 ? "bg-white/0" : ""
                        )}
                      >
                        <td className="px-3 py-2">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium">{x.name}</td>
                        <td className="px-3 py-2">
                          {x.company ? (
                            x.company
                          ) : (
                            <span className="text-admin-textMuted">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{fmtTime(x.checkinTime)}</td>
                        <td className="px-3 py-2">
                          {!x.checkinTime ? (
                            <span className="inline-flex rounded-full bg-brand-danger/10 px-2 py-0.5 text-[11px] font-semibold text-brand-danger">
                              ไม่มา
                            </span>
                          ) : x.isLate ? (
                            <span className="inline-flex rounded-full bg-brand-danger/10 px-2 py-0.5 text-[11px] font-semibold text-brand-danger">
                              สาย
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-brand-success/10 px-2 py-0.5 text-[11px] font-semibold text-brand-success">
                              ปกติ
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ClassroomDashboardClient({
  range = "today",
  rangeLabel = "วันนี้",
  initialData,
}) {
  const [active, setActive] = useState("classes");
  const [data, setData] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    let alive = true;
    let timer = null;

    async function tick() {
      setLoading(true);
      const res = await fetch(`/api/admin/classroom/dashboard?range=${range}`, {
        cache: "no-store",
      }).catch(() => null);

      const json = res ? await res.json().catch(() => null) : null;
      if (alive && json?.ok) setData(json);
      if (alive) setLoading(false);

      timer = setTimeout(tick, 4000);
    }

    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [range]);

  const totals = data?.totals || {
    totalClasses: 0,
    totalStudents: 0,
    totalCheckins: 0,
    lateCount: 0,
    absentCount: 0,
  };

  const RANGE_OPTIONS = useMemo(
    () => [
      { key: "today", label: "วันนี้" },
      { key: "week", label: "7 วันล่าสุด" },
      { key: "month", label: "เดือนนี้" },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Classroom Dashboard</h1>
          <p className="text-sm text-admin-textMuted">
            ภาพรวม Class / ผู้เรียน / การเช็คอิน ในช่วงเวลา {rangeLabel}
            {loading ? " • กำลังอัปเดต..." : ""}
          </p>
        </div>

        <div className="inline-flex rounded-full bg-admin-surface border border-admin-border p-1 text-xs">
          {RANGE_OPTIONS.map((opt) => (
            <Link
              key={opt.key}
              href={`/admin/classroom?range=${opt.key}`}
              className={cx(
                "px-3 py-1 rounded-full transition",
                range === opt.key
                  ? "bg-brand-primary text-white"
                  : "text-admin-textMuted hover:bg-admin-surfaceMuted"
              )}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          active={active === "classes"}
          label="จำนวนคลาสในช่วงนี้"
          value={totals.totalClasses}
          sub="คลาสที่ทับซ้อนช่วงเวลา"
          onClick={() => setActive("classes")}
        />
        <StatCard
          active={active === "students"}
          label="จำนวนนักเรียน"
          value={totals.totalStudents}
          sub="รวมทุกคลาสในช่วงที่เลือก"
          onClick={() => setActive("students")}
        />
        <StatCard
          active={active === "checkins"}
          label="จำนวนเช็คอิน"
          value={totals.totalCheckins}
          sub="นับจาก collection checkins"
          onClick={() => setActive("checkins")}
        />
        <StatCard
          active={active === "late"}
          label="เช็คอินสาย"
          value={totals.lateCount}
          sub="ตรวจจาก isLate"
          onClick={() => setActive("late")}
          tone="danger"
        />
        <StatCard
          active={active === "absent"}
          label="ไม่มาเช็คอิน"
          value={totals.absentCount}
          sub="นักเรียนที่ไม่มี checkin"
          onClick={() => setActive("absent")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-2xl bg-admin-surface p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">ภาพรวม</h2>
            <span className="text-[11px] text-admin-textMuted">
              โหมด: {ModeLabel(active)}
            </span>
          </div>

          {active === "classes" ? (
            data?.classCards?.length ? (
              <ul className="mt-4 space-y-3">
                {data.classCards.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-2xl border border-admin-border bg-admin-surface p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <IconBubble
                          icon={c.icon}
                          programIconUrl={c.programIconUrl}
                          classCode={c.courseCode} // ✅ แก้จาก classCode -> courseCode
                          title={c.title}
                        />
                        <div className="flex flex-col">
                          <div className="font-semibold">
                            {c.courseCode ? `${c.courseCode} – ` : ""}
                            {c.title}
                          </div>
                          <div className="text-[11px] text-admin-textMuted">
                            ห้อง {c.room}
                            {c.programName
                              ? ` • Program: ${c.programName}`
                              : ""}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="rounded-xl border border-admin-border px-3 py-2 text-center min-w-[90px]">
                          <div className="text-[11px] text-admin-textMuted">
                            นักเรียน
                          </div>
                          <div className="text-lg font-semibold">
                            {c.students}
                          </div>
                        </div>
                        <div className="rounded-xl border border-admin-border px-3 py-2 text-center min-w-[90px]">
                          <div className="text-[11px] text-admin-textMuted">
                            เช็คอิน
                          </div>
                          <div className="text-lg font-semibold">
                            {c.checkins}
                          </div>
                        </div>
                        <div className="rounded-xl border border-admin-border px-3 py-2 text-center min-w-[90px]">
                          <div className="text-[11px] text-admin-textMuted">
                            สาย
                          </div>
                          <div className="text-lg font-semibold text-brand-danger">
                            {c.late}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-admin-textMuted">
                ยังไม่มีคลาสในช่วงเวลาที่เลือก
              </p>
            )
          ) : (
            <GroupedStudentTable
              groups={data?.studentGroups || []}
              mode={active}
            />
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-admin-surface p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                เช็คอินเร็วที่สุดของวัน (TOP 3)
              </h2>
              <span className="text-[11px] text-admin-textMuted">
                รวมทุกคลาส
              </span>
            </div>

            {!data?.fastest3?.length ? (
              <p className="mt-4 text-sm text-admin-textMuted">
                ยังไม่มีการเช็คอิน
              </p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {data.fastest3.map((x, idx) => (
                  <li
                    key={x.id}
                    className="flex items-center justify-between rounded-xl border border-admin-border px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">
                        #{idx + 1} {x.name}
                      </span>
                      <span className="text-[11px] text-admin-textMuted">
                        {x.classLabel}
                      </span>
                    </div>
                    <div className="text-[12px] font-semibold">
                      {fmtTime(x.time)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl bg-admin-surface p-5 shadow-card">
            <h2 className="text-sm font-semibold">เช็คอินล่าสุด</h2>
            <p className="text-[11px] text-admin-textMuted">
              แสดง 10 รายการล่าสุด
            </p>

            {!data?.latest10?.length ? (
              <p className="mt-4 text-sm text-admin-textMuted">
                ยังไม่มีการเช็คอิน
              </p>
            ) : (
              <ul className="mt-4 space-y-2 max-h-72 overflow-y-auto text-sm">
                {data.latest10.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-admin-border px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-[11px] text-admin-textMuted">
                        {c.classLabel}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-admin-textMuted">
                        {fmtTime(c.time)}
                      </div>
                      <span
                        className={cx(
                          "inline-block mt-1 rounded-full px-2 py-0.5 text-[11px]",
                          c.isLate
                            ? "bg-brand-danger/10 text-brand-danger"
                            : "bg-brand-success/10 text-brand-success"
                        )}
                      >
                        {c.isLate ? "สาย" : "ปกติ"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
