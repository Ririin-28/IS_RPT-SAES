"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiBarChart2, FiCalendar, FiHome, FiUser } from "react-icons/fi";

const tabs = [
  { href: "/Parent/home", label: "Home", icon: FiHome, match: ["/Parent/home", "/Parent/dashboard"] },
  { href: "/Parent/progress", label: "Progress", icon: FiBarChart2, match: ["/Parent/progress"] },
  { href: "/Parent/attendance", label: "Attendance", icon: FiCalendar, match: ["/Parent/attendance"] },
  { href: "/Parent/profile", label: "Profile", icon: FiUser, match: ["/Parent/profile", "/Parent/children"] },
] as const;

export default function ParentBottomNav() {
  const pathname = usePathname();

  if (!pathname || pathname === "/Parent/welcome") {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#DCE6DD] bg-white lg:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-4 px-2 py-2">
        {tabs.map((tab) => {
          const isActive = tab.match.includes(pathname as (typeof tab.match)[number]);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-w-0 flex-col items-center justify-center rounded-[14px] px-1 py-2 text-center transition ${
                isActive ? "bg-[#0C3B1F] text-white shadow-sm" : "text-[#546958]"
              }`}
            >
              <tab.icon className="text-base" />
              <span className="mt-1 text-[10px] font-semibold tracking-tight">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
