"use client";
import React, { useCallback } from "react";
import RPTLogoTitle from "../Common/RPTLogoTitle";
import { useRouter, usePathname } from "next/navigation";

// Memoized SVG icons to prevent unnecessary re-renders
const DashboardIcon = React.memo(() => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <rect width="7" height="9" x="3" y="3" rx="1" stroke="#013300" strokeWidth="2" />
    <rect width="7" height="5" x="14" y="3" rx="1" stroke="#013300" strokeWidth="2" />
    <rect width="7" height="9" x="14" y="12" rx="1" stroke="#013300" strokeWidth="2" />
    <rect width="7" height="5" x="3" y="16" rx="1" stroke="#013300" strokeWidth="2" />
  </svg>
));

const ChildrenIcon = React.memo(() => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-baby-icon lucide-baby">
    <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M15 12h.01"/><path d="M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>
    <path d="M9 12h.01"/></svg>
));

const ProfileIcon = React.memo(() => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user-round-pen-icon lucide-user-round-pen">
    <path d="M2 21a8 8 0 0 1 10.821-7.487"/><path d="M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>
    <circle cx="10" cy="8" r="5"/></svg>
));

const NotificationsIcon = React.memo(() => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bell-ring-icon lucide-bell-ring">
    <path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M22 8c0-2.3-.8-4.3-2-6"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>
    <path d="M4 2C2.8 3.7 2 5.7 2 8"/></svg>
));

export default function Sidebar() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Menu items with navigation paths
  const menuItems = React.useMemo(
    () => [
  { label: "Dashboard", icon: <DashboardIcon />, path: "/Parent/dashboard" },
  { label: "Profile", icon: <ProfileIcon />, path: "/Parent/profile" },
  { label: "Notifications", icon: <NotificationsIcon />, path: "/Parent/notifications" },
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
            const isActive = pathname === item.path;
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
                onClick={() => handleNavigation(item.path)}
                aria-current={isActive ? "page" : undefined}
              >
                <span
                  className={`rounded-lg p-1 flex items-center justify-center shadow-md bg-green-50 text-[#013300]`}
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
