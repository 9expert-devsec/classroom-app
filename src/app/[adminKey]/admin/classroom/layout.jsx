// src/app/[adminKey]/admin/classroom/layout.jsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Upload,
  PlusCircle,
  Users2,
  UtensilsCrossed,
  CalendarDays,
  ChevronDown,
  Soup,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Toaster } from "sonner";
import AdminNotifications from "@/components/admin/AdminNotifications";
import { useEffect, useMemo, useState } from "react";
import localFont from "next/font/local";
import { PERM } from "@/lib/acl";

/** โครงสร้างเมนู (ใช้ path แบบ relative ภายใต้ /admin) */
const NAV = [
  {
    label: "Dashboard",
    href: "/classroom",
    icon: LayoutDashboard,
    perm: PERM.DASHBOARD_VIEW,
  },
  {
    label: "Classes (ตารางสอน)",
    href: "/classroom/classes",
    icon: BookOpen,
    perm: PERM.CLASSES_READ,
    children: [
      {
        label: "Class ทั้งหมด",
        href: "/classroom/classes",
        icon: Users2,
        perm: PERM.CLASSES_READ,
      },
      {
        label: "Import จาก schedule",
        href: "/classroom/classes/from-schedule",
        icon: Upload,
        perm: PERM.CLASSES_IMPORT,
      },
      {
        label: "New Class (manual)",
        href: "/classroom/classes/new",
        icon: PlusCircle,
        perm: PERM.CLASSES_WRITE,
      },
      {
        label: "Import CSV Students",
        href: "/classroom/import",
        icon: Upload,
        perm: PERM.CLASSES_IMPORT,
      },
    ],
  },

  {
    label: "Food Menu (อาหาร)",
    href: "/classroom/food",
    icon: UtensilsCrossed,
    perm: PERM.FOOD_READ,
    children: [
      {
        label: "Food Menu",
        href: "/classroom/food/restaurants",
        icon: UtensilsCrossed,
        perm: PERM.FOOD_WRITE,
      },
      {
        label: "Food Calendar",
        href: "/classroom/food/calendar",
        icon: CalendarDays,
        perm: PERM.FOOD_WRITE,
      },
      {
        label: "Food Report",
        href: "/classroom/food/report",
        icon: Soup,
        perm: PERM.FOOD_REPORT,
      },
    ],
  },

  {
    label: "Event",
    href: "/classroom/event",
    icon: CalendarDays,
    perm: PERM.EVENTS_READ,
    children: [
      {
        label: "จัดการ Event",
        href: "/classroom/event",
        icon: CalendarDays,
        perm: PERM.EVENTS_READ,
      },
      {
        label: "Create Event",
        href: "/classroom/event/new",
        icon: PlusCircle,
        perm: PERM.EVENTS_WRITE,
      },
      {
        label: "Import CSV ผู้เข้าร่วม",
        href: "/classroom/event/import",
        icon: Upload,
        perm: PERM.EVENTS_IMPORT,
      },
      {
        label: "Event Report",
        href: "/classroom/event/report",
        icon: Soup,
        perm: PERM.EVENTS_READ,
      },
    ],
  },

  {
    label: "Accounts",
    href: "/classroom/accounts",
    icon: Users2,
    perm: PERM.ACCOUNTS_MANAGE,
    children: [
      {
        label: "ผู้ใช้ทั้งหมด",
        href: "/classroom/accounts/users",
        icon: Users2,
        perm: PERM.ACCOUNTS_MANAGE,
      },
      {
        label: "บทบาทและสิทธิ์",
        href: "/classroom/accounts/roles",
        icon: LayoutDashboard,
        perm: PERM.ACCOUNTS_MANAGE,
      },
    ],
  },

  {
    label: "Audit Logs",
    href: "/classroom/audit",
    icon: Soup, // หรือเปลี่ยนเป็น icon อื่นได้
    perm: PERM.AUDIT_READ,
  },

  {
    label: "My Account",
    href: "/classroom/my-account",
    icon: Users2,
    perm: PERM.MY_ACCOUNT,
  },
];

function joinAdminBase(adminBase, href) {
  const base = String(adminBase || "").replace(/\/+$/, "");
  const h = String(href || "").trim();
  if (!h) return base || "/";
  if (h.startsWith("/")) return `${base}${h}`;
  return `${base}/${h}`;
}

/** หา /{adminKey}/admin จาก pathname */
function getAdminBaseFromPathname(pathname) {
  const p = String(pathname || "");
  const m = p.match(/^\/([^/]+)\/admin(\/.*)?$/);
  if (!m) return "/admin";
  const adminKey = m[1];
  return `/${adminKey}/admin`;
}

function filterNavByPerm(items, permSet) {
  if (!permSet) return [];

  const out = [];
  for (const item of items) {
    const hasChildren =
      Array.isArray(item.children) && item.children.length > 0;

    if (!hasChildren) {
      if (!item.perm || permSet.has(item.perm)) out.push(item);
      continue;
    }

    const children = item.children.filter(
      (c) => !c.perm || permSet.has(c.perm),
    );
    const canSeeParent = !item.perm || permSet.has(item.perm);

    // ถ้าพ่อผ่านและยังมีลูกเหลือ → แสดง
    if (canSeeParent && children.length > 0) {
      out.push({ ...item, children });
      continue;
    }

    // ถ้าพ่อผ่านแต่ไม่มีลูก → ซ่อนทั้งก้อน (กันเมนูโล่งๆ)
    // ถ้าพ่อไม่ผ่าน → ซ่อน
  }
  return out;
}

function SectionItem({ item, adminBase, collapsed }) {
  const pathname = usePathname();

  const hasChildren = item.children && item.children.length > 0;

  const itemHref = joinAdminBase(adminBase, item.href);
  const isActiveSection = hasChildren
    ? pathname.startsWith(itemHref)
    : pathname === itemHref;

  const [open, setOpen] = useState(isActiveSection);

  const Icon = item.icon;

  if (!hasChildren) {
    return (
      <div className="mb-2">
        <Link
          href={itemHref}
          title={item.label}
          className={`group flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm transition
  ${collapsed ? "justify-center" : ""}
  ${
    isActiveSection
      ? "bg-[#66ccff] text-admin-text shadow-sm"
      : "text-admin-sidebarText hover:bg-white/10"
  }`}
        >
          {Icon && (
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-xl border text-xs
      ${
        isActiveSection
          ? "border-admin-border/60 bg-admin-bg"
          : "border-white/10 bg-admin-sidebarBg"
      }`}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}

          {!collapsed && (
            <span className="flex-1 truncate text-left">{item.label}</span>
          )}
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <button
        type="button"
        title={item.label}
        onClick={() => {
          if (collapsed) return;
          setOpen((o) => !o);
        }}
        className={`group flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm transition
  ${collapsed ? "justify-center" : ""}
  ${
    isActiveSection
      ? "bg-[#66ccff] text-admin-text shadow-sm"
      : "text-admin-sidebarText hover:bg-white/10"
  }`}
      >
        {Icon && (
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-xl border text-xs
      ${
        isActiveSection
          ? "border-admin-border/60 bg-admin-bg"
          : "border-white/10 bg-admin-sidebarBg"
      }`}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}

        {!collapsed && (
          <span className="flex-1 truncate text-left">{item.label}</span>
        )}

        {!collapsed && (
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              open ? "rotate-180" : "rotate-0"
            }`}
          />
        )}
      </button>

      {!collapsed && open && (
        <div className="mt-2 pl-6">
          <div className="relative">
            <div className="absolute left-[10px] top-0 bottom-0 w-px bg-white/15" />
            <div className="space-y-1 pl-4">
              {item.children.map((child) => {
                const childHref = joinAdminBase(adminBase, child.href);
                const childActive = pathname === childHref;
                const ChildIcon = child.icon;
                return (
                  <Link
                    key={childHref}
                    href={childHref}
                    className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs transition
                    ${
                      childActive
                        ? "bg-white/70 text-admin-text shadow-sm"
                        : "text-admin-sidebarText/80 hover:bg-white/10"
                    }`}
                  >
                    {ChildIcon && <ChildIcon className="h-3 w-3 opacity-70" />}
                    <span className="truncate">{child.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lineSeedSansTH = localFont({
  src: [
    {
      path: "../../../../../public/fonts/GoogleSans-Regular.ttf",
      weight: "400",
    },
    { path: "../../../../../public/fonts/GoogleSans-Bold.ttf", weight: "700" },
  ],
  display: "swap",
});

export default function AdminClassroomLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);

  const adminBase = useMemo(
    () => getAdminBaseFromPathname(pathname),
    [pathname],
  );

  const [permSet, setPermSet] = useState(null);
  const [meLoading, setMeLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function loadMe() {
      try {
        setMeLoading(true);
        const res = await fetch("/api/admin/me", { cache: "no-store" });
        if (!alive) return;

        if (res.status === 401) {
          router.push(`${adminBase}/login`);
          return;
        }

        const data = await res.json();
        if (!alive) return;

        if (!data?.ok) throw new Error(data?.error || "Failed to load me");
        const perms = Array.isArray(data.permissions) ? data.permissions : [];
        setPermSet(new Set(perms));
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setMeLoading(false);
      }
    }

    loadMe();
    return () => {
      alive = false;
    };
  }, [adminBase, router]);

  const visibleNav = useMemo(() => filterNavByPerm(NAV, permSet), [permSet]);

  async function handleLogout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch (e) {
      console.error(e);
    }
    router.push(`${adminBase}/login`);
  }

  return (
    <div
      className={`${lineSeedSansTH.className} flex h-dvh overflow-hidden bg-admin-bg text-admin-text`}
    >
      <aside
        className={[
          "flex flex-col bg-admin-sidebarBg text-admin-sidebarText transition-all duration-200",
          collapsed ? "w-[86px]" : "w-72",
        ].join(" ")}
      >
        {/* top logo / title */}
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-semibold">
            <img
              src="/logo-9expert-app.png"
              alt="9Expert Logo"
              className="h-6 w-6"
            />
          </div>

          {!collapsed && (
            <div className="text-base font-semibold truncate">
              9Expert Classroom <br /> Operations
            </div>
          )}
        </div>

        {/* nav */}
        <div
          className={[
            collapsed ? "mx-2 p-2" : "mx-3 p-3",
            "flex-1 rounded-3xl bg-white/5 flex flex-col min-h-0",
          ].join(" ")}
        >
          <nav
            className={[
              collapsed ? "space-y-1" : "space-y-1 text-sm",
              "min-h-0",
            ].join(" ")}
          >
            {meLoading && (
              <div className="space-y-2 animate-pulse px-2 py-2">
                <div className="h-9 rounded-2xl bg-white/10" />
                <div className="h-9 rounded-2xl bg-white/10" />
                <div className="h-9 rounded-2xl bg-white/10" />
                <div className="h-9 rounded-2xl bg-white/10" />
                <div className="h-9 rounded-2xl bg-white/10" />
              </div>
            )}

            {!meLoading &&
              visibleNav.map((item) => (
                <SectionItem
                  key={item.label}
                  item={item}
                  adminBase={adminBase}
                  collapsed={collapsed}
                />
              ))}
          </nav>

          {/* Collapse button */}
          <div className="mt-auto pt-3">
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className={[
                "flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium hover:bg-white/10",
                collapsed ? "justify-center" : "justify-start",
              ].join(" ")}
              aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
              title={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
              {!collapsed && <span>{collapsed ? "ขยายเมนู" : "ย่อเมนู"}</span>}
            </button>
          </div>
        </div>

        {/* Logout */}
        <div className={collapsed ? "mx-2 mb-4 mt-3" : "mx-3 mb-4 mt-3"}>
          <button
            type="button"
            onClick={handleLogout}
            className={[
              "flex w-full items-center gap-2 rounded-2xl bg-red-500/90 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-500",
              collapsed ? "justify-center" : "justify-center",
            ].join(" ")}
            title="ออกจากระบบ"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>ออกจากระบบ</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden px-6 py-5 min-h-0">
        <div className="flex-1 min-h-0">{children}</div>
      </main>

      <Toaster position="top-right" richColors closeButton />
      <AdminNotifications />
    </div>
  );
}
