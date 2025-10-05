"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function TeacherWelcome() {
  const [count, setCount] = useState(3);
  const router = useRouter();

  // Countdown timer - redirect to teacher dashboard
  useEffect(() => {
    if (count === 0) router.push("/Teacher/dashboard");
    const timer = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(timer);
  }, [count, router]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-blue-100 via-blue-50 to-white">
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
            <stop stopColor="#bfdbfe" />
            <stop offset="1" stopColor="#dbeafe" stopOpacity="0" />
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
            <stop stopColor="#93c5fd" />
            <stop offset="1" stopColor="#eff6ff" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full px-4">
        <h2 className="text-xl md:text-2xl font-semibold text-blue-900 mb-4 text-center pb-12">
          Welcome,
          <br />
          Teacher!
        </h2>
  <h1 className="text-2xl md:text-6xl font-bold text-blue-900 text-center mb-8">Maria Santos</h1>
        <div className="text-xl md:text-2xl text-blue-800 font-semibold text-center flex items-center justify-center">
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