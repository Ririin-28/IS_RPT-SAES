"use client";

import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import RPTLogoTitle from "../../Common/RPTLogoTitle";
import { BookOpenCheck, CalendarDays, FolderOpen, GraduationCap } from "lucide-react";
import { FaChalkboardTeacher } from "react-icons/fa";

type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
};

const DashboardIcon = React.memo(() => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <rect width="7" height="9" x="3" y="3" rx="1" stroke="#013300" strokeWidth="2" />
    <rect width="7" height="5" x="14" y="3" rx="1" stroke="#013300" strokeWidth="2" />
    <rect width="7" height="9" x="14" y="12" rx="1" stroke="#013300" strokeWidth="2" />
    <rect width="7" height="5" x="3" y="16" rx="1" stroke="#013300" strokeWidth="2" />
  </svg>
));
DashboardIcon.displayName = "DashboardIcon";

const CalendarIcon = React.memo(() => (
  <CalendarDays className="h-6 w-6" />
));
CalendarIcon.displayName = "CalendarIcon";

const StudentsIcon = React.memo(() => (
  <GraduationCap className="h-6 w-6" />
));
StudentsIcon.displayName = "StudentsIcon";

const TeachersIcon = React.memo(() => (
  <FaChalkboardTeacher className="h-6 w-6" />
));
TeachersIcon.displayName = "TeachersIcon";

const MaterialsIcon = React.memo(() => (
  <FolderOpen className="h-6 w-6" />
));
MaterialsIcon.displayName = "MaterialsIcon";

const RemedialIcon = React.memo(() => (
  <BookOpenCheck className="h-6 w-6" />
));
RemedialIcon.displayName = "RemedialIcon";

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/MasterTeacher/Coordinator/dashboard", icon: <DashboardIcon /> },
  { label: "Calendar", path: "/MasterTeacher/Coordinator/calendar", icon: <CalendarIcon /> },
  { label: "Students", path: "/MasterTeacher/Coordinator/students", icon: <StudentsIcon /> },
  { label: "Teachers", path: "/MasterTeacher/Coordinator/teachers", icon: <TeachersIcon /> },
  { label: "Materials", path: "/MasterTeacher/Coordinator/materials", icon: <MaterialsIcon /> },
  { label: "Remedial", path: "/MasterTeacher/Coordinator/remedial", icon: <RemedialIcon /> },
];

export default function CoordinatorSidebar() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const toggleSidebar = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setOpen(false);
  }, []);

  const handleNavigation = useCallback(
    (path: string) => {
      router.push(path);
      closeSidebar();
    },
    [router, closeSidebar]
  );

  const isActive = useCallback(
    (path: string) => Boolean(pathname?.toLowerCase().startsWith(path.toLowerCase())),
    [pathname]
  );

  return (
    <>
      <button
        className="md:hidden fixed top-5 left-4 z-50 bg-green-50 p-2 rounded-lg shadow-md"
        onClick={toggleSidebar}
        aria-label="Open sidebar"
      >
        <svg
          width="24"
          height="24"
          fill="none"
          stroke="#013300"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      <aside
        className={`
          fixed z-50 top-0 left-0 h-full w-64 bg-green-50 flex flex-col px-6 py-8 font-sans
          transition-transform duration-300 shadow-xl
          ${open ? "translate-x-0" : "-translate-x-full"} rounded-xl
          md:static md:translate-x-0 md:min-h-screen
        `}
        style={{ maxWidth: "100vw" }}
      >
        <div className="flex md:hidden justify-end mb-4">
          <button className="p-2 rounded hover:bg-green-100" onClick={closeSidebar} aria-label="Close sidebar">
            <svg
              width="24"
              height="24"
              fill="none"
              stroke="#013300"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <RPTLogoTitle small />

        <div className="my-6 border-b border-[#013300]" />

        <nav className="flex flex-col gap-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.label}
                type="button"
                className={`
                  flex items-center gap-4 font-medium text-base px-3 py-2 rounded-lg transition-all
                  ${active ? "bg-[#013300] text-white shadow" : "text-[#013300]"}
                  hover:ring-2 hover:ring-[#013300] hover:scale-[1.03] hover:shadow
                `}
                onClick={() => handleNavigation(item.path)}
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={`rounded-lg p-1 flex items-center justify-center shadow-md ${
                    active ? "bg-white text-[#013300]" : "bg-green-50"
                  }`}
                >
                  {item.icon}
                </span>
                <span className="tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {open && (
        <div
          className="fixed inset-0 backdrop-blur-xs bg-opacity-30 z-40 md:hidden"
          onClick={closeSidebar}
          aria-label="Close sidebar overlay"
        />
      )}
    </>
  );
}