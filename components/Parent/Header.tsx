"use client";
import React from "react";
import { useRouter } from "next/navigation";
import ProfileDropdown from "../Common/ProfileDropdown";
import { performClientLogout } from "@/lib/utils/logout";

interface ParentHeaderProps {
  title?: string;
  onSearch?: (query: string) => void;
  childOptions?: Array<{ id: string; label: string }>;
  selectedChildId?: string | null;
  onChildSelect?: (childId: string) => void;
}

export default function ParentHeader({
  title,
  onSearch,
  childOptions,
  selectedChildId,
  onChildSelect,
}: ParentHeaderProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showDropdown, setShowDropdown] = React.useState(false);
  const router = useRouter();
  const profileBtnRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Hide dropdowns when clicking outside
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!profileBtnRef.current?.contains(e.target as Node) && !dropdownRef.current?.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDropdown]);

  return (
    <>
      {/* Page Header (for dashboard, etc.) */}
      {title && (
        <header
          className={
            `
            /* Mobile */
            fixed top-2 left-4 right-2 h-16 flex items-center justify-between px-4 bg-green-50 shadow-md z-30 rounded-xl transition-all
            /* Desktop */
            md:left-4 md:right-4 md:px-8
          `
          }
        >
          <span className="text-base font-semibold text-[#013300] tracking-wide md:text-lg">{title}</span>
          <div className="relative flex items-center">
            <button
              ref={profileBtnRef}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-[#013300] 
              hover:border-[#013300] hover:border-2 hover:scale-[1.08] hover:shadow transition"
              aria-label="Profile"
              onClick={() => setShowDropdown((v) => !v)}
            >
              <svg width="32" height="32" fill="none" stroke="#013300" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20v-2c0-2.5 3.5-4 8-4s8 1.5 8 4v2" />
              </svg>
            </button>
            {showDropdown && (
              <div ref={dropdownRef}>
                <ProfileDropdown
                  onProfile={() => {
                    setShowDropdown(false);
                    router.push("/Parent/profile");
                  }}
                  onLogout={() => {
                    setShowDropdown(false);
                    performClientLogout(router);
                  }}
                  childOptions={childOptions}
                  selectedChildId={selectedChildId}
                  onChildSelect={(childId) => {
                    setShowDropdown(false);
                    onChildSelect?.(childId);
                  }}
                />
              </div>
            )}
          </div>
        </header>
      )}
    </>
  );
}