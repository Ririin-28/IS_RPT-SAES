"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FiBarChart2, FiCalendar, FiHome, FiLogOut, FiUser } from "react-icons/fi";
import { performClientLogout } from "@/lib/utils/logout";

export default function ParentSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: "/Parent/home", label: "Home", icon: FiHome, match: ["/Parent/home", "/Parent/dashboard"] },
    { href: "/Parent/progress", label: "Progress", icon: FiBarChart2, match: ["/Parent/progress"] },
    { href: "/Parent/attendance", label: "Attendance", icon: FiCalendar, match: ["/Parent/attendance"] },
    { href: "/Parent/profile", label: "Profile", icon: FiUser, match: ["/Parent/profile", "/Parent/children"] },
  ];

  return (
    <aside className="hidden h-screen w-[19rem] flex-col gap-5 px-4 py-5 lg:flex">
      <div className="rounded-[24px] border border-[#DCE6DD] bg-white p-6 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6A816F]">Parent Portal</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0C3B1F]">Family Dashboard</h2>
        <p className="mt-2 text-sm leading-6 text-[#57705C]">
          Progress, attendance, and school updates in one place.
        </p>
      </div>

      <nav className="flex-1 rounded-[24px] border border-[#DCE6DD] bg-white p-3 shadow-sm">
        {links.map((link) => {
          const isActive = link.match.includes(pathname ?? "");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`mb-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                isActive
                  ? "bg-[#0C3B1F] text-white shadow-sm"
                  : "text-[#35513D] hover:bg-white hover:text-[#0C3B1F]"
              }`}
            >
              <link.icon className="text-base" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="rounded-[24px] border border-[#DCE6DD] bg-white p-3 shadow-sm">
        <button
          type="button"
          onClick={() => performClientLogout(router)}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-[#7A2433] transition hover:bg-[#FFF4F5]"
        >
          <FiLogOut />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
