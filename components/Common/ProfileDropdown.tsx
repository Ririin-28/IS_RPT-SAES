"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
type RoleSwitchOption = {
  label: string;
  description?: string;
  active?: boolean;
  onSelect: () => void;
};

interface ProfileDropdownProps {
  email: string;
  name: string;
  onProfile?: () => void;
  onLogout?: () => void;
  roleOptions?: RoleSwitchOption[];
}

export default function ProfileDropdown({ email, name, onProfile, onLogout, roleOptions }: ProfileDropdownProps) {
  const router = useRouter();

  const handleProfileClick = () => {
    if (onProfile) {
      onProfile();
      return;
    }
    router.push("/Proponent/profile");
  };

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
      return;
    }
    signOut({ callbackUrl: "/auth/login?logout=true" });
  };

  return (
    <div
      className="
      /* Mobile */
      absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-4 flex flex-col items-center
      /* Tablet */
      sm:w-72 sm:p-6
      /* Desktop */
      md:w-80 md:p-8
    "
    >
      <span className="text-sm text-[#013300] font-semibold mb-2">{email}</span>
      <div className="my-2">
        <svg width="56" height="56" fill="none" stroke="#013300" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="6" />
          <path d="M4 20v-2c0-3.5 5-5 8-5s8 1.5 8 5v2" />
        </svg>
      </div>
      <div className="text-lg font-bold text-[#013300] mb-2 sm:text-xl md:text-2xl">Hi! {name}!</div>
      <hr className="w-full my-2 border-gray-300" />
      <button
        className="w-full text-left px-2 py-2 rounded text-[#013300] hover:bg-green-50 font-medium sm:px-4 sm:py-3 md:px-6 md:py-4"
        onClick={handleProfileClick}
      >
        My Profile
      </button>
      <button
        className="w-full text-left px-2 py-2 rounded text-[#013300] hover:bg-green-50 font-medium sm:px-4 sm:py-3 md:px-6 md:py-4"
        onClick={handleLogoutClick}
      >
        Logout
      </button>
      {roleOptions && roleOptions.length > 0 && (
        <>
          <hr className="w-full my-2 border-gray-300" />
          <div className="w-full">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Switch Role</p>
            <div className="flex flex-col gap-2">
              {roleOptions.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={option.onSelect}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-all duration-150 ${
                    option.active
                      ? "bg-[#013300] text-white border-[#013300] shadow"
                      : "border-transparent bg-green-50 text-[#013300] hover:border-[#013300] hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{option.label}</span>
                    {option.active && <span className="text-xs font-semibold uppercase">Active</span>}
                  </div>
                  {option.description && (
                    <p className={`text-xs mt-1 ${option.active ? "text-green-100" : "text-gray-600"}`}>
                      {option.description}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

