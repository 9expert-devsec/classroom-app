// src/app/[adminKey]/admin/classroom/ClassroomDashboardClient.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function SkeletonBox({ className }) {
  return (
    <div
      className={cx(
        "animate-pulse rounded-xl bg-admin-surfaceMuted/70",
        className,
      )}
    />
  );
}

function SkeletonLine({ className }) {
  return <SkeletonBox className={cx("h-3 rounded-lg", className)} />;
}

function SkeletonIcon() {
  return <SkeletonBox className="h-10 w-10 rounded-xl" />;
}

function SkeletonClassCards() {
  return (
    <ul className="mt-4 space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="rounded-2xl border border-admin-border bg-admin-surface p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <SkeletonIcon />
              <div className="space-y-2">
                <SkeletonLine className="w-56" />
                <SkeletonLine className="w-40" />
              </div>
            </div>

            <div className="flex gap-3">
              <SkeletonBox className="h-[60px] min-w-[90px]" />
              <SkeletonBox className="h-[60px] min-w-[90px]" />
              <SkeletonBox className="h-[60px] min-w-[90px]" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SkeletonStudentGroups({ groups = 2, rows = 5 }) {
  return (
    <div className="mt-4 space-y-4">
      {Array.from({ length: groups }).map((_, gi) => (
        <div
          key={gi}
          className="rounded-2xl border border-admin-border bg-admin-surface p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <SkeletonIcon />
              <div className="space-y-2">
                <SkeletonLine className="w-64" />
                <SkeletonLine className="w-44" />
              </div>
            </div>

            <div className="space-y-2 text-right">
              <SkeletonLine className="w-24 ml-auto" />
              <SkeletonLine className="w-28 ml-auto" />
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-admin-border">
            <div className="bg-admin-surfaceMuted px-3 py-2">
              <SkeletonLine className="w-72" />
            </div>

            <div className="divide-y divide-admin-border">
              {Array.from({ length: rows }).map((_, ri) => (
                <div key={ri} className="flex items-center gap-3 px-3 py-3">
                  <SkeletonLine className="w-10" />
                  <SkeletonLine className="w-56" />
                  <SkeletonLine className="w-40" />
                  <SkeletonLine className="w-24 ml-auto" />
                  <SkeletonBox className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonAsideList({ count = 3 }) {
  return (
    <ul className="mt-4 space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="flex items-center justify-between rounded-xl border border-admin-border px-3 py-2"
        >
          <div className="space-y-2">
            <SkeletonLine className="w-40" />
            <SkeletonLine className="w-56" />
          </div>
          <SkeletonLine className="w-12" />
        </li>
      ))}
    </ul>
  );
}

function fmtTime(t) {
  if (!t) return "-";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateTimeTH(t) {
  if (!t) return "-";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isHttpUrl(x) {
  return /^https?:\/\//i.test(String(x || "").trim());
}

function IconBubble({ icon, classCode, title, programIconUrl }) {
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
          : "border-admin-border bg-admin-surface hover:bg-admin-surfaceMuted",
      )}
    >
      <p className="text-xs text-admin-textMuted">{label}</p>
      <p
        className={cx(
          "mt-2 text-2xl font-semibold",
          tone === "danger" ? "text-brand-danger" : "",
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
        const totalInClass = Number.isFinite(Number(g?.totalInClass))
          ? Number(g.totalInClass)
          : 0;

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
                          idx % 2 ? "bg-white/0" : "",
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

function isStudentMode(active) {
  return ["students", "checkins", "late", "absent"].includes(active);
}

/* ---------------- main ---------------- */

export default function ClassroomDashboardClient({
  range = "today",
  rangeLabel = "วันนี้",
  initialData,
  from = "",
  to = "",
}) {
  const router = useRouter();

  const [active, setActive] = useState("classes");
  const [data, setData] = useState(initialData || null);

  const [loading, setLoading] = useState(!initialData);
  const [errorMsg, setErrorMsg] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(
    initialData ? new Date().toISOString() : "",
  );

  // ✅ state สำหรับ filter bar
  const [currentRange, setCurrentRange] = useState(range || "today");
  const [customFrom, setCustomFrom] = useState(from || "");
  const [customTo, setCustomTo] = useState(to || "");
  const [showCustom, setShowCustom] = useState(currentRange === "custom");

  const [loadingPart, setLoadingPart] = useState({
    cards: !initialData,
    students: false,
    lists: false,
    program: false,
  });

  // กันยิง students ซ้ำถี่ ๆ
  const loadedStudentsKeyRef = useRef("");

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
      { key: "custom", label: "กำหนดเอง" },
    ],
    [],
  );

  function buildQs(nextRange, nextFrom, nextTo) {
    const qs = new URLSearchParams();
    qs.set("range", nextRange);
    if (nextRange === "custom") {
      if (nextFrom) qs.set("from", nextFrom);
      if (nextTo) qs.set("to", nextTo);
    }
    return qs.toString();
  }

  async function refresh(nextParams) {
    const nextRange = nextParams?.range ?? currentRange;
    const nextFrom = nextParams?.from ?? customFrom;
    const nextTo = nextParams?.to ?? customTo;

    const include = nextParams?.include || "cards";
    const mode = nextParams?.mode || "";
    const silent = !!nextParams?.silent;

    const includeList = String(include || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const wantsCards = includeList.includes("cards");
    const wantsStudents = includeList.includes("students");
    const wantsLists = includeList.includes("lists");
    const wantsProgram = includeList.includes("program");

    setErrorMsg("");
    if (!silent) setLoading(true);

    // ✅ set skeleton loading per section
    setLoadingPart((p) => ({
      ...p,
      ...(wantsCards ? { cards: true } : null),
      ...(wantsStudents ? { students: true } : null),
      ...(wantsLists ? { lists: true } : null),
      ...(wantsProgram ? { program: true } : null),
    }));

    const qs = buildQs(nextRange, nextFrom, nextTo);
    const url =
      `/api/admin/classroom/dashboard?${qs}` +
      `&include=${encodeURIComponent(include)}` +
      (mode ? `&mode=${encodeURIComponent(mode)}` : "");

    try {
      const res = await fetch(url, { cache: "no-store" }).catch(() => null);
      const json = res ? await res.json().catch(() => null) : null;

      if (json?.ok) {
        setData((prev) => ({ ...(prev || {}), ...json }));
        setLastUpdatedAt(new Date().toISOString());
      } else {
        const msg =
          json?.error ||
          json?.message ||
          (!res ? "network_error" : `request_failed (${res.status})`);
        setErrorMsg(String(msg));
      }
    } finally {
      if (!silent) setLoading(false);

      // ✅ unset skeleton loading per section
      setLoadingPart((p) => ({
        ...p,
        ...(wantsCards ? { cards: false } : null),
        ...(wantsStudents ? { students: false } : null),
        ...(wantsLists ? { lists: false } : null),
        ...(wantsProgram ? { program: false } : null),
      }));
    }
  }

  // โหลดเริ่มต้น (ถ้าไม่มี initialData)
  useEffect(() => {
    if (!initialData) {
      refresh({ include: "cards,lists" });
    }
    // เติม program/icons แบบ background (ไม่ทำให้หน้า "ช้า")
    refresh({ include: "cards,program", silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ sync state ถ้า props range/from/to เปลี่ยน
  useEffect(() => {
    setCurrentRange(range || "today");
    setShowCustom((range || "today") === "custom");
    setCustomFrom(from || "");
    setCustomTo(to || "");
    loadedStudentsKeyRef.current = ""; // reset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, from, to]);

  // ✅ เวลาเปลี่ยนโหมดเป็นรายชื่อ ให้โหลด students อัตโนมัติ
  useEffect(() => {
    if (!isStudentMode(active)) return;

    const key = `${currentRange}|${customFrom}|${customTo}|${active}`;
    if (loadedStudentsKeyRef.current === key) return;

    loadedStudentsKeyRef.current = key;
    refresh({ include: "students", mode: active, silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  async function handlePickRange(nextRange) {
    setCurrentRange(nextRange);
    setShowCustom(nextRange === "custom");
    loadedStudentsKeyRef.current = "";

    const qs = buildQs(nextRange, customFrom, customTo);
    router.replace(`/a1exqwvCqTXP7s0/admin/classroom?${qs}`);

    if (nextRange !== "custom") {
      await refresh({ range: nextRange, include: "cards,lists" });
      refresh({ range: nextRange, include: "cards,program", silent: true });

      // ถ้าอยู่โหมดรายชื่อ ให้โหลดรายชื่อของโหมดนั้นต่อทันที
      if (isStudentMode(active)) {
        refresh({
          range: nextRange,
          include: "students",
          mode: active,
          silent: true,
        });
      }
    }
  }

  async function applyCustom() {
    if (!customFrom || !customTo) {
      setErrorMsg("กรุณาเลือกวันที่เริ่มและวันที่สิ้นสุด");
      return;
    }
    if (customFrom > customTo) {
      setErrorMsg("ช่วงวันไม่ถูกต้อง (from ต้องไม่มากกว่า to)");
      return;
    }

    loadedStudentsKeyRef.current = "";

    const qs = buildQs("custom", customFrom, customTo);
    router.replace(`/a1exqwvCqTXP7s0/admin/classroom?${qs}`);

    await refresh({
      range: "custom",
      from: customFrom,
      to: customTo,
      include: "cards,lists",
    });

    refresh({
      range: "custom",
      from: customFrom,
      to: customTo,
      include: "cards,program",
      silent: true,
    });

    if (isStudentMode(active)) {
      refresh({
        range: "custom",
        from: customFrom,
        to: customTo,
        include: "students",
        mode: active,
        silent: true,
      });
    }
  }

  const RANGE_LABEL_MAP = {
    today: "วันนี้",
    week: "7 วันล่าสุด",
    month: "เดือนนี้",
    custom: "ช่วงวันที่กำหนดเอง",
  };
  const computedRangeLabel = RANGE_LABEL_MAP[currentRange] || rangeLabel || "";

  const expectedStudentMode = active === "classes" ? "" : active;
  const studentReady =
    active === "classes"
      ? true
      : String(data?.studentMode || "") === String(expectedStudentMode);

  const showStudentSkeleton =
    active !== "classes" && (loadingPart.students || !studentReady);

  const showCardsSkeleton =
    active === "classes" && loadingPart.cards && !data?.classCards?.length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden">
      <div className="shrink-0 min-h-0 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Classroom Dashboard</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-sm text-admin-textMuted">
                ภาพรวม Class / ผู้เรียน / การเช็คอิน ในช่วงเวลา{" "}
                {computedRangeLabel}
                {loading ? " • กำลังโหลด..." : ""}
              </p>

              {lastUpdatedAt ? (
                <span className="inline-flex items-center rounded-full border border-admin-border bg-admin-surface px-2 py-0.5 text-[11px] text-admin-textMuted">
                  อัปเดตล่าสุด {fmtDateTimeTH(lastUpdatedAt)}
                </span>
              ) : null}

              {errorMsg ? (
                <span className="inline-flex items-center rounded-full border border-brand-danger/30 bg-brand-danger/10 px-2 py-0.5 text-[11px] font-semibold text-brand-danger">
                  {errorMsg}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                loadedStudentsKeyRef.current = "";
                refresh({ include: "cards,lists" });
                refresh({ include: "cards,program", silent: true });
                if (isStudentMode(active))
                  refresh({ include: "students", mode: active, silent: true });
              }}
              disabled={loading}
              className={cx(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition",
                loading
                  ? "border-admin-border bg-admin-surface text-admin-textMuted opacity-70"
                  : "border-admin-border bg-admin-surface text-admin-textMuted hover:bg-admin-surfaceMuted",
              )}
              title="Refresh ข้อมูล"
            >
              <RefreshCw
                className={cx("h-4 w-4", loading ? "animate-spin" : "")}
              />
              Refresh
            </button>

            <div className="inline-flex rounded-full bg-admin-surface border border-admin-border p-1 text-xs">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handlePickRange(opt.key)}
                  className={cx(
                    "px-3 py-1 rounded-full transition",
                    currentRange === opt.key
                      ? "bg-brand-primary text-white"
                      : "text-admin-textMuted hover:bg-admin-surfaceMuted",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {showCustom ? (
          <div className="rounded-2xl border border-admin-border bg-admin-surface p-4 shadow-card">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] text-admin-textMuted mb-1">
                  วันที่เริ่ม
                </label>
                <input
                  type="date"
                  className="rounded-lg border border-admin-border bg-white px-3 py-1.5 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] text-admin-textMuted mb-1">
                  วันที่สิ้นสุด
                </label>
                <input
                  type="date"
                  className="rounded-lg border border-admin-border bg-white px-3 py-1.5 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>

              <button
                type="button"
                onClick={applyCustom}
                disabled={loading}
                className={cx(
                  "rounded-lg px-4 py-2 text-sm font-semibold",
                  loading
                    ? "bg-admin-surfaceMuted text-admin-textMuted opacity-70"
                    : "bg-brand-primary text-white hover:opacity-95",
                )}
              >
                ใช้ช่วงวันที่นี้
              </button>
            </div>

            <p className="mt-2 text-[11px] text-admin-textMuted">
              * เลือกช่วงวันแล้วกด “ใช้ช่วงวันที่นี้” เพื่อโหลดข้อมูล
            </p>
          </div>
        ) : null}

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
      </div>

      <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[2fr,1fr] p-1">
        <div className="flex h-full min-h-0 flex-col rounded-2xl bg-admin-surface p-5 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between shrink-0">
            <h2 className="text-sm font-semibold">ภาพรวม</h2>
            <span className="text-[11px] text-admin-textMuted">
              โหมด: {ModeLabel(active)}
            </span>
          </div>

          <div className="mt-2 flex-1 min-h-0 overflow-auto">
            {active === "classes" ? (
              showCardsSkeleton ? (
                <SkeletonClassCards />
              ) : data?.classCards?.length ? (
                <ul className="space-y-3">
                  {data.classCards.map((c) => (
                    /* ✅ ของเดิมคุณ */
                    <li
                      key={c.id}
                      className="rounded-2xl border border-admin-border bg-admin-surface p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <IconBubble
                            icon={c.icon}
                            programIconUrl={c.programIconUrl}
                            classCode={c.courseCode}
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
                <p className="text-sm text-admin-textMuted">
                  ยังไม่มีคลาสในช่วงเวลาที่เลือก
                </p>
              )
            ) : showStudentSkeleton ? (
              <SkeletonStudentGroups />
            ) : (
              <GroupedStudentTable
                groups={data?.studentGroups || []}
                mode={active}
              />
            )}
          </div>
        </div>

        <div className="flex h-full min-h-0 flex-col gap-4">
          <div className="flex h-full min-h-0 flex-col rounded-2xl bg-admin-surface p-5 shadow-sm overflow-hidden">
            <div className="shrink-0">
              <h2 className="text-sm font-semibold">เช็คอินล่าสุด</h2>
              <p className="text-[11px] text-admin-textMuted">
                แสดง 10 รายการล่าสุด
              </p>
            </div>

            <div className="mt-4 flex-1 min-h-0 overflow-auto">
              {loadingPart.lists ? (
                <SkeletonAsideList count={6} />
              ) : !data?.latest10?.length ? (
                <p className="mt-4 text-sm text-admin-textMuted">
                  ยังไม่มีการเช็คอิน
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
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
                              : "bg-brand-success/10 text-brand-success",
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
          
          <div className="rounded-2xl bg-admin-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                เช็คอินเร็วที่สุดของวัน (TOP 3)
              </h2>
              <span className="text-[11px] text-admin-textMuted">
                รวมทุกคลาส
              </span>
            </div>

            {loadingPart.lists ? (
              <SkeletonAsideList count={3} />
            ) : !data?.fastest3?.length ? (
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

          
        </div>
      </div>
    </div>
  );
}
