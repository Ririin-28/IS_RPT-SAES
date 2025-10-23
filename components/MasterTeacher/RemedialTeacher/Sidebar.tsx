"use client";

import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import RPTLogoTitle from "../../Common/RPTLogoTitle";

type NavChild = {
  label: string;
  path: string;
};

type NavItem = {
  label: string;
  path?: string;
  icon: React.ReactNode;
  children?: NavChild[];
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
    <ellipse cx="12" cy="8" rx="4" ry="4" stroke="#013300" strokeWidth="2" />
    <path d="M4 18v-2c0-2.66 5.33-4 8-4s8 1.34 8 4v2" stroke="#013300" strokeWidth="2" strokeLinecap="round" />
  </svg>
));
StudentsIcon.displayName = "StudentsIcon";

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
    <path d="M2 6h4" stroke="#013300" strokeWidth="2" />
    <path d="M2 10h4" stroke="#013300" strokeWidth="2" />
    <path d="M2 14h4" stroke="#013300" strokeWidth="2" />
    <path d="M2 18h4" stroke="#013300" strokeWidth="2" />
    <path d="M9.5 8h5" stroke="#013300" strokeWidth="2" />
    <path d="M9.5 12H16" stroke="#013300" strokeWidth="2" />
    <path d="M9.5 16H14" stroke="#013300" strokeWidth="2" />
  </svg>
));
RemedialIcon.displayName = "RemedialIcon";

const ReportIcon = React.memo(() => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <rect width="16" height="20" x="4" y="2" rx="2" stroke="#013300" strokeWidth="2" />
    <path d="M8 6h8" stroke="#013300" strokeWidth="2" />
    <path d="M8 10h8" stroke="#013300" strokeWidth="2" />
    <path d="M8 14h5" stroke="#013300" strokeWidth="2" />
  </svg>
));
ReportIcon.displayName = "ReportIcon";

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/MasterTeacher/RemedialTeacher/dashboard", icon: <DashboardIcon /> },
  { label: "Calendar", path: "/MasterTeacher/RemedialTeacher/calendar", icon: <CalendarIcon /> },
  { label: "Students", path: "/MasterTeacher/RemedialTeacher/students", icon: <StudentsIcon /> },
  {
    label: "Materials",
    path: "/MasterTeacher/RemedialTeacher/materials",
    icon: <MaterialsIcon />,
    children: [
      { label: "English", path: "/MasterTeacher/RemedialTeacher/materials/english" },
      { label: "Filipino", path: "/MasterTeacher/RemedialTeacher/materials/filipino" },
      { label: "Math", path: "/MasterTeacher/RemedialTeacher/materials/math" },
    ],
  },
  {
    label: "Remedial",
    icon: <RemedialIcon />,
    children: [
      { label: "English", path: "/MasterTeacher/RemedialTeacher/remedial/english" },
      { label: "Filipino", path: "/MasterTeacher/RemedialTeacher/remedial/filipino" },
      { label: "Math", path: "/MasterTeacher/RemedialTeacher/remedial/math" },
    ],
  },
  { label: "Report", path: "/MasterTeacher/RemedialTeacher/report", icon: <ReportIcon /> },
];

export default function RemedialTeacherSidebar() {
  const [open, setOpen] = React.useState(false);
  const [openSubmenu, setOpenSubmenu] = React.useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const toggleSidebar = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setOpen(false);
    setOpenSubmenu(null);
  }, []);

  const handleNavigation = useCallback(
    (path: string) => {
      router.push(path);
      closeSidebar();
    },
    [router, closeSidebar]
  );

  const isActivePath = useCallback(
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
            const hasChildren = Boolean(item.children && item.children.length > 0);
            const childActive = hasChildren
              ? item.children!.some((child) => isActivePath(child.path))
              : false;
            const active = item.path ? isActivePath(item.path) || childActive : childActive;
            const expanded = hasChildren && (openSubmenu === item.label || childActive);

            if (hasChildren) {
              return (
                <div key={item.label} className="group relative">
                  <button
                    type="button"
                    className={`
                      w-full flex items-center gap-4 font-medium text-base px-3 py-2 rounded-lg transition-all
                      ${active ? "bg-[#013300] text-white shadow" : "text-[#013300]"}
                      hover:ring-2 hover:ring-[#013300] hover:scale-[1.02] hover:shadow
                    `}
                    onClick={() => setOpenSubmenu((prev) => (prev === item.label ? null : item.label))}
                    aria-expanded={expanded}
                    aria-haspopup="true"
                  >
                    <span
                      className={`rounded-lg p-1 flex items-center justify-center shadow-md ${
                        active ? "bg-white text-[#013300]" : "bg-green-50"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="tracking-wide flex-1 text-left">{item.label}</span>
                    <svg
                      className={`w-4 h-4 transition-transform duration-300 ${expanded ? "rotate-180" : "rotate-0"}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <div
                    className={`
                      overflow-hidden transition-all duration-300 ease-in-out
                      ${expanded ? "max-h-60 opacity-100" : "max-h-0 opacity-0"}
                      md:group-hover:max-h-60 md:group-hover:opacity-100
                    `}
                  >
                    <div className="flex flex-col mt-1 gap-2 rounded-lg bg-green-50 p-2">
                      {item.children!.map((child) => {
                        const childIsActive = isActivePath(child.path);
                        return (
                          <button
                            key={child.label}
                            type="button"
                            className={`
                              w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                              ${childIsActive ? "bg-[#013300] text-white shadow" : "text-[#013300]"}
                              hover:ring-2 hover:ring-[#013300] hover:scale-[1.02] hover:shadow
                            `}
                            onClick={() => handleNavigation(child.path)}
                          >
                            {child.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <button
                key={item.label}
                type="button"
                className={`
                  flex items-center gap-4 font-medium text-base px-3 py-2 rounded-lg transition-all
                  ${active ? "bg-[#013300] text-white shadow" : "text-[#013300]"}
                  hover:ring-2 hover:ring-[#013300] hover:scale-[1.03] hover:shadow
                `}
                onClick={() => handleNavigation(item.path!)}
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