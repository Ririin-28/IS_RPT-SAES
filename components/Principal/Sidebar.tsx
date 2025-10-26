"use client";
import React, { useCallback } from "react";
import RPTLogoTitle from "../Common/RPTLogoTitle";
import { useRouter, usePathname } from "next/navigation";

const MaterialsIcon = React.memo(() => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <rect x="3" y="7" width="18" height="14" rx="2" stroke="#013300" strokeWidth="2" />
    <rect x="7" y="3" width="10" height="4" rx="1" stroke="#013300" strokeWidth="2" />
  </svg>
));

// Memoized SVG icons to prevent unnecessary re-renders
const DashboardIcon = React.memo(() => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <rect width="7" height="9" x="3" y="3" rx="1" stroke="#013300" strokeWidth="2" />
    <rect width="7" height="5" x="14" y="3" rx="1" stroke="#013300" strokeWidth="2" />
    <rect width="7" height="9" x="14" y="12" rx="1" stroke="#013300" strokeWidth="2" />
    <rect width="7" height="5" x="3" y="16" rx="1" stroke="#013300" strokeWidth="2" />
  </svg>
));

const CalendarIcon = React.memo(() => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <rect x="3" y="5" width="18" height="16" rx="2" stroke="#013300" strokeWidth="2" />
    <rect x="3" y="8" width="18" height="2" stroke="#013300" strokeWidth="2" />
    <rect x="7" y="12" width="2" height="2" stroke="#013300" strokeWidth="2" />
    <rect x="11" y="12" width="2" height="2" stroke="#013300" strokeWidth="2" />
    <rect x="15" y="12" width="2" height="2" stroke="#013300" strokeWidth="2" />
  </svg>
));

const StudentsIcon = React.memo(() => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <ellipse cx="12" cy="8" rx="4" ry="4" stroke="#013300" strokeWidth="2" />
    <path d="M4 18v-2c0-2.66 5.33-4 8-4s8 1.34 8 4v2" stroke="#013300" strokeWidth="2" strokeLinecap="round" />
  </svg>
));

const TeachersIcon = React.memo(() => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <circle cx="8" cy="8" r="4" stroke="#013300" strokeWidth="2" />
    <circle cx="16" cy="8" r="4" stroke="#013300" strokeWidth="2" />
    <rect x="2" y="16" width="20" height="4" rx="2" stroke="#013300" strokeWidth="2" />
  </svg>
));

const ReportsIcon = React.memo(() => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-chart-line-icon lucide-file-chart-line"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m16 13-3.5 3.5-2-2L8 17"/></svg>
));

type MenuChild = {
  label: string;
  href: string;
  subject: string;
};

type MenuItem = {
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: MenuChild[];
};

export default function Sidebar() {
  const [open, setOpen] = React.useState(false);
  const [openSubmenu, setOpenSubmenu] = React.useState<string | null>(null);
  const [isDesktop, setIsDesktop] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname() ?? "";

  // Menu items with navigation paths
  const menuItems = React.useMemo<MenuItem[]>(
    () => [
      { label: "Dashboard", icon: <DashboardIcon />, path: "/Principal/dashboard" },
      { label: "Calendar", icon: <CalendarIcon />, path: "/Principal/calendar" },
      { label: "Students", icon: <StudentsIcon />, path: "/Principal/students" },
      { label: "Teachers", icon: <TeachersIcon />, path: "/Principal/teachers" },
      {
        label: "Materials",
        icon: <MaterialsIcon />,
        path: "/Principal/materials",
        children: [
          { label: "English", href: "/Principal/materials/english", subject: "english" },
          { label: "Filipino", href: "/Principal/materials/filipino", subject: "filipino" },
          { label: "Math", href: "/Principal/materials/mathematics", subject: "mathematics" },
        ],
      },
      {
        label: "Reports",
        icon: <ReportsIcon />,
        path: "/Principal/reports",
        children: [
          { label: "English", href: "/Principal/reports/english", subject: "english" },
          { label: "Filipino", href: "/Principal/reports/filipino", subject: "filipino" },
          { label: "Math", href: "/Principal/reports/math", subject: "math" },
        ],
      },
    ],
    []
  );

  // Memoized toggle function
  const toggleSidebar = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  // Memoized close function
  const closeSidebar = useCallback(() => {
    setOpen(false);
    setOpenSubmenu(null);
  }, []);

  React.useEffect(() => {
    const updateViewport = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  React.useEffect(() => {
    if (isDesktop) {
      setOpenSubmenu(null);
    }
  }, [isDesktop]);

  const handleMouseEnter = useCallback((label: string) => {
    if (isDesktop) {
      setOpenSubmenu(label);
    }
  }, [isDesktop]);

  const handleMouseLeave = useCallback(() => {
    if (isDesktop) {
      setOpenSubmenu(null);
    }
  }, [isDesktop]);

  const handleSubmenuToggle = useCallback((label: string) => {
    setOpenSubmenu((prev) => (prev === label ? null : label));
  }, []);

  // Handle navigation with sidebar close
  const handleNavigation = useCallback(
    (path: string) => {
      router.push(path);
      closeSidebar();
    },
    [router, closeSidebar]
  );

  return (
    <>
      {/* Mobile Hamburger Button */}
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

      {/* Sidebar */}
      <aside
        className={`
          fixed z-50 top-0 left-0 h-full w-64 bg-green-50 flex flex-col px-6 py-8 font-sans 
          transition-transform duration-300 shadow-xl 
          ${open ? "translate-x-0" : "-translate-x-full"} rounded-xl
          md:static md:translate-x-0 md:min-h-screen
        `}
        style={{ maxWidth: "100vw" }}
      >
        {/* Mobile Close Button */}
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

        {/* Logo and Title */}
        <RPTLogoTitle small />

        {/* Divider */}
        <div className="my-6 border-b border-[#013300]" />

        {/* Menu Items */}
        <nav className="flex flex-col gap-3">
          {menuItems.map((item) => {
            const hasChildren = Boolean(item.children && item.children.length > 0);
            const basePath = item.path ?? "";
            const childMatches = hasChildren
              ? item.children!.some((child: MenuChild) => pathname === child.href || pathname.startsWith(`${child.href}/`))
              : false;
            const isActive = pathname === basePath || childMatches;
            const isSubmenuOpen = openSubmenu === item.label;
            const submenuHeight = hasChildren ? item.children!.length * 48 + 16 : 0;

            if (hasChildren) {
              return (
                <div 
                  key={item.label} 
                  className="group relative"
                  onMouseEnter={() => handleMouseEnter(item.label)}
                  onMouseLeave={handleMouseLeave}
                >
                  {/* Parent (clickable to toggle submenu on mobile) */}
                  <button
                    type="button"
                    className={`
                      w-full flex items-center gap-4 font-medium text-base px-3 py-2 rounded-lg transition-all
                      ${isActive ? "bg-[#013300] text-white shadow" : "text-[#013300]"}
                      hover:ring-2 hover:ring-[#013300] hover:scale-[1.02] hover:shadow
                    `}
                    onClick={() => handleSubmenuToggle(item.label)}
                    aria-expanded={isSubmenuOpen}
                    aria-haspopup="true"
                  >
                    <span className={`rounded-lg p-1 flex items-center justify-center shadow-md ${
                      isActive ? "bg-white text-[#013300]" : "bg-green-50 text-[#013300]"
                    }`}>
                      {item.icon}
                    </span>
                    <span className="tracking-wide flex-1 text-left">{item.label}</span>
                    {/* Chevron icon for submenu */}
                    <svg
                      className={`w-4 h-4 transition-transform duration-300 ${
                        isSubmenuOpen ? "rotate-180" : "rotate-0"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown with smooth transition - appears below the parent */}
                  <div
                    className={`
                      overflow-hidden transition-all duration-300 ease-in-out
                      ${isSubmenuOpen ? "max-h-48 opacity-100" : "max-h-0 opacity-0"}
                      md:group-hover:max-h-48 md:group-hover:opacity-100
                    `}
                    style={{
                      maxHeight: isSubmenuOpen ? submenuHeight : 0,
                      opacity: isSubmenuOpen ? 1 : 0,
                    }}
                  >
                    <div className="flex flex-col mt-1 gap-2 rounded-lg bg-green-50 p-2">
                      {item.children!.map((child: MenuChild) => {
                        const isChildActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                        return (
                          <button
                            key={child.label}
                            type="button"
                            className={`
                              w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                              ${isChildActive ? "bg-[#013300] text-white shadow" : "text-[#013300]"}
                              hover:ring-2 hover:ring-[#013300] hover:scale-[1.02] hover:shadow
                            `}
                            onClick={() => handleNavigation(child.href)}
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

            // Normal items
            return (
              <button
                key={item.label}
                className={`
                  flex items-center gap-4 font-medium text-base px-3 py-2 rounded-lg transition-all
                  ${isActive ? "bg-[#013300] text-white shadow" : "text-[#013300]"}
                  hover:ring-2 hover:ring-[#013300] hover:scale-[1.03] hover:shadow
                  focus:outline-none focus:ring-2 focus:bg-[#013300] focus:text-white
                  active:bg-[#013300] active:text-white
                `}
                onClick={() => handleNavigation(item.path!)}
                aria-current={isActive ? "page" : undefined}
              >
                <span
                  className={`rounded-lg p-1 flex items-center justify-center shadow-md ${
                    isActive ? "bg-white text-[#013300]" : "bg-green-50 text-[#013300]"
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

      {/* Mobile Overlay */}
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
