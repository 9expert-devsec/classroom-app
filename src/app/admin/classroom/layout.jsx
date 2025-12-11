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
} from "lucide-react";
import { useState } from "react";

/** โครงสร้างเมนู */
const NAV = [
  {
    label: "Dashboard",
    href: "/admin/classroom",
    icon: LayoutDashboard,
  },
  {
    label: "Classes (จาก DB)",
    href: "/admin/classroom/classes",
    icon: BookOpen,
    children: [
      {
        label: "Class ทั้งหมด",
        href: "/admin/classroom/classes",
        icon: Users2,
      },
      {
        label: "Import จาก schedule",
        href: "/admin/classroom/classes/from-schedule",
        icon: Upload,
      },
      {
        label: "New Class (manual)",
        href: "/admin/classroom/classes/new",
        icon: PlusCircle,
      },
      {
        label: "Import CSV Students",
        href: "/admin/classroom/import",
        icon: Upload,
      },
    ],
  },
  {
    label: "Food Menu",
    href: "/admin/classroom/food",
    icon: UtensilsCrossed,
    children: [
      {
        label: "Food Menu",
        href: "/admin/classroom/food",
        icon: UtensilsCrossed,
      },
      {
        label: "Food Calendar",
        href: "/admin/classroom/food/calendar",
        icon: CalendarDays,
      },
      {
        label: "Food Report",
        href: "/admin/classroom/food/report",
        icon: Soup,
      },
    ],
  },
];

function SectionItem({ item }) {
  const pathname = usePathname();
    const hasChildren = item.children && item.children.length > 0;

   const isActiveSection = hasChildren
    ? pathname.startsWith(item.href)
    : pathname === item.href;
  const [open, setOpen] = useState(isActiveSection);

  const Icon = item.icon;


  // --------- ไม่มี children -> ลิงก์ธรรมดา ---------
  if (!hasChildren) {
    return (
      <div className="mb-2">
        <Link
          href={item.href}
          className={`group flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm transition
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

          <span className="flex-1 truncate text-left">{item.label}</span>
        </Link>
      </div>
    );
  }

  // --------- มี children -> ปุ่ม + submenu ---------
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`group flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm transition
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

        <span className="flex-1 truncate text-left">{item.label}</span>

        <ChevronDown
          className={`h-4 w-4 transition-transform ${
            open ? "rotate-180" : "rotate-0"
          }`}
        />
      </button>

      {open && (
        <div className="mt-2 pl-6">
          <div className="relative">
            <div className="absolute left-[10px] top-0 bottom-0 w-px bg-white/15" />
            <div className="space-y-1 pl-4">
              {item.children.map((child) => {
                const childActive = pathname === child.href;
                const ChildIcon = child.icon;
                return (
                  <Link
                    key={child.href}
                    href={child.href}
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

export default function AdminClassroomLayout({ children }) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch (e) {
      console.error(e);
    }
    router.push("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-admin-bg text-admin-text">
      <aside className="flex w-72 flex-col bg-admin-sidebarBg text-admin-sidebarText">
        {/* top logo / title */}
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold">
            9E
          </div>
          <div className="text-base font-semibold">9Expert Admin</div>
        </div>

        {/* nav */}
        <div className="mx-3 flex-1 rounded-3xl bg-white/5 p-3">
          <nav className="space-y-1 text-sm">
            {NAV.map((item) => (
              <SectionItem key={item.label} item={item} />
            ))}
          </nav>
        </div>

        {/* ปุ่ม Logout ด้านล่าง sidebar */}
        <div className="mx-3 mb-4 mt-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500/90 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-500"
          >
            <LogOut className="h-4 w-4" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 px-6 py-5">{children}</main>
    </div>
  );
}
