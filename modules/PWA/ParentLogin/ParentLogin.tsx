"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { clearStoredUserProfile, storeUserProfile } from "@/lib/utils/user-profile";

const DEFAULT_ERROR_MESSAGE = "Unable to sign in with those parent credentials.";

type ParentLoginProps = {
  onBack: () => void;
};

const normalizeRole = (role: string | null | undefined): string => {
  if (!role) {
    return "";
  }
  return role
    .toLowerCase()
    .replace(/[\s/-]+/g, "_");
};

export default function ParentLogin({ onBack }: ParentLoginProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const verifyParentSession = async () => {
      try {
        const response = await fetch("/api/parent/session", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!active) {
          return;
        }

        if (response.ok) {
          window.location.replace("/Parent/welcome");
          return;
        }
      } catch {
        // Ignore session probe errors and keep the login view available.
      }

      if (active) {
        setIsCheckingSession(false);
      }
    };

    void verifyParentSession();

    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Enter the parent email address and password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const deviceToken = window.localStorage.getItem("deviceToken") || "";
      const deviceName = window.navigator.userAgent;
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          deviceToken,
          deviceName,
          expectedRole: "parent",
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || data?.error) {
        throw new Error(data?.error ?? DEFAULT_ERROR_MESSAGE);
      }

      const normalizedRole = normalizeRole(data?.role);
      if (normalizedRole !== "parent") {
        throw new Error("This entry is only for parent accounts.");
      }

      const redirectPath = data?.redirectPath || "/Parent/welcome";

      if (data?.skipOtp) {
        storeUserProfile({
          firstName: data.first_name,
          middleName: data.middle_name,
          lastName: data.last_name,
          role: data.role,
          userId: data.user_id,
          email: data.email ?? email.trim(),
        });
        try {
          window.sessionStorage.setItem("wasLoggedOut", "false");
        } catch (storageError) {
          console.warn("Unable to persist logout marker", storageError);
        }
        window.location.replace(redirectPath);
        return;
      }

      clearStoredUserProfile();
      const params = new URLSearchParams({
        email: email.trim(),
        role: data?.role || "parent",
        user_id: String(data?.user_id ?? ""),
        redirect_path: redirectPath,
      }).toString();
      router.push(`/auth/verification?${params}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden overflow-y-auto px-4 py-6 text-[#013300] sm:py-8 md:flex md:items-center md:justify-center">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(209,255,222,0.45),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(188,240,214,0.35),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,249,245,0.95))]" />
      <div className="pointer-events-none absolute left-[10%] right-[50%] top-32 -z-10 h-56 rounded-3xl bg-linear-to-br from-green-200/50 via-white/40 to-transparent blur-4xl" />
      <div className="pointer-events-none absolute left-[55%] right-[10%] bottom-16 -z-10 h-56 rounded-[40px] bg-linear-to-t from-green-200/60 via-white/35 to-transparent blur-4xl" />

      <div className="mx-auto w-full max-w-md rounded-3xl border border-green-100/80 bg-white/90 p-5 shadow-xl backdrop-blur-sm sm:p-8">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold text-[#013300]/70 hover:text-[#013300]"
        >
          Back to portal home
        </button>

        <div className="mt-4 flex flex-col items-center text-center">
          <Image
            src="/RPT-SAES/RPTLogo.png"
            alt="RPT-SAES Logo"
            width={72}
            height={72}
            className="h-16 w-16 object-contain drop-shadow-md"
          />
          <h1 className="mt-3 text-3xl font-bold bg-linear-to-r from-green-800 to-[#013300] bg-clip-text text-transparent">
            Parent Portal
          </h1>
          <p className="mt-2 text-sm text-[#013300]/65">
            Sign in with a parent account to open the parent dashboard inside the PWA.
          </p>
        </div>

        {isCheckingSession ? (
          <div className="mt-8 rounded-2xl border border-green-100 bg-green-50/70 px-4 py-5 text-center text-sm font-medium text-[#013300]/75">
            Checking parent session...
          </div>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={handleLogin}>
            <div>
              <label htmlFor="parent-email" className="block text-sm font-semibold text-[#013300]/80 mb-2">
                Parent Email
              </label>
              <input
                id="parent-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email address"
                className="w-full rounded-xl border-2 border-[#013300]/15 bg-white px-4 py-3 text-[#013300] outline-none transition focus:border-[#013300]"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label htmlFor="parent-password" className="block text-sm font-semibold text-[#013300]/80 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="parent-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border-2 border-[#013300]/15 bg-white px-4 py-3 pr-12 text-[#013300] outline-none transition focus:border-[#013300]"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  className="absolute inset-y-0 right-4 flex items-center text-[#013300]/45 hover:text-[#013300]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash className="h-5 w-5" /> : <FaEye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {errorMessage ? (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-[#013300] px-6 py-3 font-bold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? "Signing in..." : "Login as Parent"}
            </button>

            <div className="text-center text-sm">
              <Link href="/auth/forgot_password" className="font-semibold text-green-700 hover:text-green-900">
                Forgot password?
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
