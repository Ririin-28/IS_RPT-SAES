"use client";

import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import RPTLogoTitle from "../../Common/RPTLogoTitle";

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
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <rect x="3" y="5" width="18" height="16" rx="2" stroke="#013300" strokeWidth="2" />
    <rect x="3" y="8" width="18" height="2" stroke="#013300" strokeWidth="2" />
    <rect x="7" y="12" width="2" height="2" stroke="#013300" strokeWidth="2" />
    <rect x="11" y="12" width="2" height="2" stroke="#013300" strokeWidth="2" />
    <rect x="15" y="12" width="2" height="2" stroke="#013300" strokeWidth="2" />
  </svg>
));
CalendarIcon.displayName = "CalendarIcon";

const StudentsIcon = React.memo(() => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <circle cx="12" cy="8" r="4" stroke="#013300" strokeWidth="2" />
    <path d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6" stroke="#013300" strokeWidth="2" />
  </svg>
));
StudentsIcon.displayName = "StudentsIcon";

const TeachersIcon = React.memo(() => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <circle cx="8" cy="8" r="4" stroke="#013300" strokeWidth="2" />
    <circle cx="16" cy="8" r="4" stroke="#013300" strokeWidth="2" />
    <rect x="2" y="16" width="20" height="4" rx="2" stroke="#013300" strokeWidth="2" />
  </svg>
));
TeachersIcon.displayName = "TeachersIcon";

const MaterialsIcon = React.memo(() => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <rect x="3" y="7" width="18" height="14" rx="2" stroke="#013300" strokeWidth="2" />
    <rect x="7" y="3" width="10" height="4" rx="1" stroke="#013300" strokeWidth="2" />
  </svg>
));
MaterialsIcon.displayName = "MaterialsIcon";

const RemedialIcon = React.memo(() => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <rect width="16" height="20" x="4" y="2" rx="2" stroke="#013300" strokeWidth="2" />
    <path d="M8 6h8" stroke="#013300" strokeWidth="2" />
    <path d="M8 10h8" stroke="#013300" strokeWidth="2" />
    <path d="M8 14h5" stroke="#013300" strokeWidth="2" />
  </svg>
));
RemedialIcon.displayName = "RemedialIcon";

const ArchiveIcon = React.memo(() => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="20" height="5" x="2" y="3" rx="1" />
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    <path d="M10 12h4" />
  </svg>
));
ArchiveIcon.displayName = "ArchiveIcon";

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/MasterTeacher/Coordinator/dashboard", icon: <DashboardIcon /> },
  { label: "Calendar", path: "/MasterTeacher/Coordinator/calendar", icon: <CalendarIcon /> },
  { label: "Students", path: "/MasterTeacher/Coordinator/students", icon: <StudentsIcon /> },
  { label: "Teachers", path: "/MasterTeacher/Coordinator/teachers", icon: <TeachersIcon /> },
  { label: "Materials", path: "/MasterTeacher/Coordinator/materials", icon: <MaterialsIcon /> },
  { label: "Remedial", path: "/MasterTeacher/Coordinator/remedial", icon: <RemedialIcon /> },
  { label: "Archive", path: "/MasterTeacher/Coordinator/archive", icon: <ArchiveIcon /> },
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