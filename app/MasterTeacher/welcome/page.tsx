"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PropWelcomePage() {
  const [count, setCount] = useState(3);
  const router = useRouter();

  // Countdown timer
  useEffect(() => {
    if (count === 0) router.push("/MasterTeacher/dashboard");
    const timer = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(timer);
  }, [count, router]);

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
          Master Teacher!
        </h2>
        <h1 className="text-2xl md:text-6xl font-bold text-green-900 text-center mb-8">Mr. Juan Dela Cruz</h1>
        <div className="text-lg text-green-800 font-medium text-center">Redirecting to dashboard in {count}...</div>
      </div>
    </div>
  );
}


