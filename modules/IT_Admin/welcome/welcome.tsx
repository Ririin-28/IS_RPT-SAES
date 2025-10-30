"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredDisplayName } from "@/lib/utils/user-profile";

const IT_ADMIN_FALLBACK_NAME = "SAES Admin";

export default function ITAdminWelcome() {
  const [count, setCount] = useState(3);
  const [displayName, setDisplayName] = useState(IT_ADMIN_FALLBACK_NAME);
  const router = useRouter();

  useEffect(() => {
    if (count === 0) router.push("/IT_Admin/dashboard");
    const timer = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(timer);
  }, [count, router]);

  useEffect(() => {
    setDisplayName(getStoredDisplayName(IT_ADMIN_FALLBACK_NAME));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-green-100 via-green-50 to-white">
      {/* Decorative static background shapes */}
      <svg className="absolute left-0 top-0 w-2/3 h-2/3 opacity-30 blur-2xl z-0" viewBox="0 0 400 400" fill="none">
        <circle cx="200" cy="200" r="200" fill="url(#paint0_radial)" />
        <defs>
          <radialGradient
            id="paint0_radial"
            cx="0"
            cy="0"
            r="1"
            gradientTransform="translate(200 200) scale(200)"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#bbf7d0" />
            <stop offset="1" stopColor="#a7f3d0" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
      <svg className="absolute right-0 bottom-0 w-1/2 h-1/2 opacity-20 blur-2xl z-0" viewBox="0 0 300 300" fill="none">
        <circle cx="150" cy="150" r="150" fill="url(#paint1_radial)" />
        <defs>
          <radialGradient
            id="paint1_radial"
            cx="0"
            cy="0"
            r="1"
            gradientTransform="translate(150 150) scale(150)"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#6ee7b7" />
            <stop offset="1" stopColor="#f0fdf4" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full px-4">
        <h2 className="text-xl md:text-2xl font-semibold text-green-900 mb-4 text-center pb-12">
          Welcome,
          <br />
          IT Admin!
        </h2>
  <h1 className="text-2xl md:text-6xl font-bold text-green-900 text-center mb-8">{displayName}</h1>
        <div className="text-xl md:text-2xl text-green-800 font-semibold text-center flex items-center justify-center">
          Redirecting to dashboard
          <span className="ml-2 flex gap-1">
            <span className="inline-block animate-dot1">.</span>
            <span className="inline-block animate-dot2">.</span>
            <span className="inline-block animate-dot3">.</span>
          </span>
        </div>
        <style jsx>{`
          .animate-dot1 {
            animation: bounceDot 1.2s infinite;
            animation-delay: 0s;
          }
          .animate-dot2 {
            animation: bounceDot 1.2s infinite;
            animation-delay: 0.3s;
          }
          .animate-dot3 {
            animation: bounceDot 1.2s infinite;
            animation-delay: 0.6s;
          }
          @keyframes bounceDot {
            0%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-10px); }
          }
        `}</style>
      </div>
    </div>
  );
}