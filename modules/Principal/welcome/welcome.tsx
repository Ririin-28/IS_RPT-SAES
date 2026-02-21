"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredDisplayName } from "@/lib/utils/user-profile";

const PRINCIPAL_FALLBACK_NAME = "Ana Reyes";

export default function PrincipalWelcome() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(PRINCIPAL_FALLBACK_NAME);

  useEffect(() => {
    router.push("/Principal/dashboard");
  }, [router]);

  useEffect(() => {
    setDisplayName(getStoredDisplayName(PRINCIPAL_FALLBACK_NAME));
  }, []);

  return (
    <div className="relative min-h-dvh flex items-center justify-center overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full px-4">
        <h2 className="text-xl md:text-2xl font-semibold text-green-900 mb-4 text-center pb-12">
          Welcome,
          <br />
          Principal!
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