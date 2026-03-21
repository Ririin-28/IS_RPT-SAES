"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { FiChevronLeft } from "react-icons/fi";
import { clearStoredUserProfile, storeUserProfile } from "@/lib/utils/user-profile";
import { storeParentPortalEntry } from "@/lib/utils/parent-portal-entry";

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

    storeParentPortalEntry("pwa");

    const markLoggedOutFromQuery = () => {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get("logout") === "true") {
          window.sessionStorage.setItem("wasLoggedOut", "true");
          url.searchParams.delete("logout");
          window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
        }
      } catch {
        // Ignore URL/storage errors and continue with session probe.
      }
    };

    const isMarkedLoggedOut = () => {
      try {
        return window.sessionStorage.getItem("wasLoggedOut") === "true";
      } catch {
        return false;
      }
    };

    markLoggedOutFromQuery();

    const verifyParentSession = async () => {
      if (isMarkedLoggedOut()) {
        if (active) {
          setIsCheckingSession(false);
        }
        return;
      }

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

    type PageShowEvent = Event & { persisted?: boolean };

    const handlePageShow = (event: Event) => {
      const persisted = Boolean((event as PageShowEvent)?.persisted);
      if (!persisted) {
        return;
      }

      if (isMarkedLoggedOut()) {
        if (active) {
          setIsCheckingSession(false);
        }
        return;
      }

      if (active) {
        setIsCheckingSession(true);
      }
      void verifyParentSession();
    };

    const handlePopState = () => {
      if (isMarkedLoggedOut()) {
        if (active) {
          setIsCheckingSession(false);
        }
        return;
      }

      if (active) {
        setIsCheckingSession(true);
      }
      void verifyParentSession();
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("popstate", handlePopState);

    void verifyParentSession();

    return () => {
      active = false;
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("popstate", handlePopState);
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
        router.replace(redirectPath);
        return;
      }

      clearStoredUserProfile();
      try {
        window.sessionStorage.setItem("wasLoggedOut", "false");
      } catch (storageError) {
        console.warn("Unable to persist logout marker", storageError);
      }
      storeParentPortalEntry("pwa");
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
    <div className="relative min-h-dvh w-full overflow-hidden bg-[#edf0ee] text-[#013300]">
      <button
        type="button"
        onClick={onBack}
        className="absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 inline-flex items-center gap-1 text-base font-semibold leading-none text-[#013300]/80 transition hover:text-[#013300]"
        aria-label="Back"
      >
        <FiChevronLeft className="h-5 w-5" />
        <span className="leading-none">Back</span>
      </button>

      <div className="mt-[calc(env(safe-area-inset-top)+3rem)] flex min-h-[calc(100dvh-env(safe-area-inset-top)-3rem)] w-full flex-col justify-center overflow-y-auto rounded-t-[30px] bg-[#f7f8f7] px-4 pt-6 pb-7">
        <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
          <Image
            src="/RPT-SAES/RPTLogo.png"
            alt="RPT-SAES Logo"
            width={72}
            height={72}
            className="h-14 w-14 object-contain"
          />
          <h1 className="mt-4 text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] text-[#013300] sm:text-3xl">
            Welcome to the
            <br />
            Parent Portal
          </h1>
          <p className="mt-2 text-sm font-medium text-[#013300]/72 sm:text-base">Sign in to your account</p>
        </div>

        {isCheckingSession ? (
          <div className="mx-auto mt-7 flex w-full max-w-md flex-col items-center justify-center gap-3 rounded-2xl border border-[#013300]/10 bg-[#f6faf5] px-4 py-6 text-center">
            <span
              className="h-6 w-6 animate-spin rounded-full border-2 border-[#013300]/20 border-t-[#013300]"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-[#013300]/70">Loading...</p>
          </div>
        ) : (
          <form className="mx-auto mt-7 w-full max-w-md space-y-4" onSubmit={handleLogin}>
            <div>
              <label htmlFor="parent-email" className="block text-sm font-bold text-[#013300]/80 mb-2">
                Parent Email
              </label>
              <input
                id="parent-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email address"
                className="w-full rounded-2xl border border-[#013300]/13 bg-[#f3f5f4] px-4 py-3.5 text-base text-[#013300] outline-none transition placeholder:text-[#013300]/42 focus:border-[#013300]/45"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label htmlFor="parent-password" className="block text-sm font-bold text-[#013300]/80 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="parent-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-2xl border border-[#013300]/13 bg-[#f3f5f4] px-4 py-3.5 pr-12 text-base text-[#013300] outline-none transition placeholder:text-[#013300]/42 focus:border-[#013300]/45"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  className="absolute inset-y-0 right-4 flex items-center text-[#013300]/35 hover:text-[#013300]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash className="h-5 w-5" /> : <FaEye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {errorMessage ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              className="min-h-13 w-full rounded-2xl bg-[#013300] px-6 py-3 text-base font-bold text-white transition hover:bg-[#024100] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? "Signing in..." : "Login as Parent"}
            </button>

            <div className="pt-1 text-center text-sm">
              <Link href="/auth/forgot_password" className="font-semibold text-[#013300]/82 hover:text-[#013300]">
                Forgot password?
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
