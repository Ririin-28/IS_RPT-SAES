"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
interface ProfileDropdownProps {
  email: string;
  name: string;
  onProfile?: () => void;
  onLogout?: () => void;
}

export default function ProfileDropdown({ email, name, onProfile, onLogout }: ProfileDropdownProps) {
  const router = useRouter();

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
        onClick={() => router.push("/Proponent/profile")}
      >
        My Profile
      </button>
      <button
        className="w-full text-left px-2 py-2 rounded text-[#013300] hover:bg-green-50 font-medium sm:px-4 sm:py-3 md:px-6 md:py-4"
        onClick={() => signOut({ callbackUrl: '/auth/login?logout=true' })}
      >
        Logout
      </button>
    </div>
  );
}

