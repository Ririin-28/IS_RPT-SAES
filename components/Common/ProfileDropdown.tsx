"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { performClientLogout } from "@/lib/utils/logout";
import { getStoredUserProfile, formatFullNameWithMiddleInitial } from "@/lib/utils/user-profile";
type RoleSwitchOption = {
  label: string;
  description?: string;
  active?: boolean;
  onSelect: () => void;
};

interface ProfileDropdownProps {
  email?: string;
  name?: string;
  onProfile?: () => void;
  onLogout?: () => void;
  roleOptions?: RoleSwitchOption[];
}

export default function ProfileDropdown({ email, name, onProfile, onLogout, roleOptions }: ProfileDropdownProps) {
  const router = useRouter();

  const storedProfile = React.useMemo(() => getStoredUserProfile(), []);

  const resolvedEmail = React.useMemo(() => {
    if (email && email.trim().length > 0) {
      return email.trim();
    }
    const storedEmail = storedProfile?.email;
    if (typeof storedEmail === "string" && storedEmail.trim().length > 0) {
      return storedEmail.trim();
    }
    return "No email on file";
  }, [email, storedProfile]);

  const resolvedName = React.useMemo(() => {
    if (name && name.trim().length > 0) {
      return name.trim();
    }
    const lastName = storedProfile?.lastName;
    if (typeof lastName === "string" && lastName.trim().length > 0) {
      return lastName.trim();
    }
    const formatted = formatFullNameWithMiddleInitial(storedProfile);
    if (formatted && formatted.trim().length > 0) {
      return formatted.trim();
    }
    const firstName = storedProfile?.firstName;
    if (typeof firstName === "string" && firstName.trim().length > 0) {
      return firstName.trim();
    }
    return "User";
  }, [name, storedProfile]);

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
    performClientLogout(router);
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
      <span className="text-sm text-[#013300] font-semibold mb-2">{resolvedEmail}</span>
      <div className="my-2">
        <svg width="56" height="56" fill="none" stroke="#013300" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="6" />
          <path d="M4 20v-2c0-3.5 5-5 8-5s8 1.5 8 5v2" />
        </svg>
      </div>
      <div className="text-lg font-bold text-[#013300] mb-2 sm:text-xl md:text-2xl">Hi! {resolvedName}!</div>
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
                      : "border-transparent text-[#013300] hover:bg-green-50"
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

