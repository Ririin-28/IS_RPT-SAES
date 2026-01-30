"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiHome, FiUser, FiBell, FiLogOut } from "react-icons/fi";

export default function ParentSidebar() {
  const pathname = usePathname();

  const links = [
    { href: "/Parent/dashboard", label: "Dashboard", icon: FiHome },
    { href: "/Parent/children", label: "Children", icon: FiUser },
    { href: "/Parent/notifications", label: "Notifications", icon: FiBell },
  ];

  return (
    <div className="w-64 h-screen bg-green-900 text-white flex flex-col">
      <div className="p-6 text-2xl font-bold">SAES Parent</div>
      <nav className="flex-1 px-4 py-4 space-y-2">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive ? "bg-green-800 text-white" : "text-green-100 hover:bg-green-800"
              }`}
            >
              <link.icon />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-green-800">
        <button className="flex items-center gap-3 px-4 py-3 w-full text-green-100 hover:bg-green-800 rounded-lg transition-colors">
          <FiLogOut />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
