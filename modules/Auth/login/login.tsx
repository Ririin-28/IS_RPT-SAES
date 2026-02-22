"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { FaEye, FaEyeSlash, FaInfoCircle } from "react-icons/fa";
import RPTLogoTitle from "@/components/Common/RPTLogoTitle";
import { clearOAuthState } from "@/lib/utils/clear-oauth-state";
import { clearStoredUserProfile, getStoredUserProfile, storeUserProfile } from "@/lib/utils/user-profile";

const DEFAULT_LOGIN_ERROR_MESSAGE = "Email and password do not match our records. Please try again.";

const normalizeRole = (role: string | null | undefined): string => {
  if (!role) {
    return "";
  }
  return role
    .toLowerCase()
    .replace(/[\s/\-]+/g, "_");
};

type LoginProps = {
  infoMessage?: string;
  requireUserId?: boolean; // backward compatibility
  requireItAdminId?: boolean;
};

export default function Login({
  infoMessage = "For San Agustin Elementary School authorized accounts only.",
  requireUserId = false,
  requireItAdminId = false,
}: LoginProps = {}) {
  const adminIdRequired = Boolean(requireItAdminId || requireUserId);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [itAdminId, setItAdminId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState(DEFAULT_LOGIN_ERROR_MESSAGE);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sanitizedItAdminId = useMemo(() => itAdminId.trim(), [itAdminId]);
  const trimmedEmail = useMemo(() => email.trim(), [email]);
  const trimmedPassword = useMemo(() => password.trim(), [password]);
  const canSubmit = adminIdRequired
    ? Boolean(trimmedEmail && trimmedPassword && sanitizedItAdminId)
    : Boolean(trimmedEmail && trimmedPassword);

  const resolveWelcomePath = useCallback((role: string | null | undefined): string => {
    const normalized = normalizeRole(role);
    switch (normalized) {
      case "super_admin":
      case "superadmin":
      case "it_admin":
      case "admin":
      case "itadmin":
        return "/Super_Admin/welcome";
      case "principal":
        return "/Principal/welcome";
      case "parent":
        return "/Parent/welcome";
      case "teacher":
        return "/Teacher/welcome";
      case "master_teacher":
      case "masterteacher":
        return "/MasterTeacher/welcome";
      default:
        return "/";
    }
  }, []);
  
  // Live credential check
  useEffect(() => {
    let active = true;
    const hasValidAdminId = sanitizedItAdminId.length > 0;
    const canVerify = adminIdRequired ? Boolean(email && password && hasValidAdminId) : Boolean(email && password);
    if (canVerify) {
      setVerifying(true);
      setSuccess(false);
      setError(false);
      fetch("/api/auth/check-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          itAdminId: adminIdRequired ? sanitizedItAdminId : undefined,
        }),
      })
        .then(async res => {
          const data = await res.json();
          if (!active) return;
          if (!data.match) {
            setSuccess(false);
            setError(true);
          } else {
            setSuccess(true);
            setError(false);
          }
        })
        .catch(() => {
          if (!active) return;
          setSuccess(false);
          setError(true);
        })
        .finally(() => {
          if (!active) return;
          setVerifying(false);
        });
    } else {
      setSuccess(false);
      setError(false);
      setVerifying(false);
    }
    return () => {
      active = false;
    };
  }, [adminIdRequired, email, password, sanitizedItAdminId]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const isLoggedOut = urlParams.get("logout") === "true";
      const hasError = urlParams.get("error");
      const wasLoggedOut = sessionStorage.getItem("wasLoggedOut") === "true";
      const prefillEmail = urlParams.get("email");
      if (prefillEmail) {
        setEmail(prefillEmail);
      }

      if (hasError === "OAuthCallback") {
        clearOAuthState();
        return;
      }

      if (isLoggedOut) {
        sessionStorage.setItem("wasLoggedOut", "true");
      }

      if (!isLoggedOut && !wasLoggedOut) {
        const storedProfile = getStoredUserProfile();
        if (storedProfile?.role) {
          const normalizedRole = normalizeRole(storedProfile.role);
          const isAdminRole = ["super_admin", "superadmin", "admin", "it_admin", "itadmin"].includes(normalizedRole);

          if (!isAdminRole) {
            router.push(resolveWelcomePath(storedProfile.role));
            return;
          }

          // Prevent login<->welcome loops: only auto-redirect admin users when server session is valid.
          try {
            const response = await fetch("/api/super_admin/session", {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            });
            if (response.ok) {
              router.push(resolveWelcomePath(storedProfile.role));
              return;
            }
          } catch {
            // Ignore and keep user on login page
          }

          clearStoredUserProfile();
        }
      }
    };

    void checkSession();
  }, [resolveWelcomePath, router]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setErrorMessage("Please enter your email and password to continue.");
      setShowErrorModal(true);
      return;
    }
    setIsLoading(true);
    try {
      if (adminIdRequired) {
        if (!sanitizedItAdminId) {
          setErrorMessage("Please enter your Super Admin ID to sign in.");
          setShowErrorModal(true);
          setIsLoading(false);
          return;
        }
      }
      const deviceToken = localStorage.getItem("deviceToken") || "";
      const deviceName = navigator.userAgent;
      console.log("[LOGIN] deviceToken sent:", deviceToken);
      console.log("[LOGIN] deviceName sent:", deviceName);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          itAdminId: adminIdRequired ? sanitizedItAdminId : undefined,
          deviceToken,
          deviceName,
        }),
      });
      const data = await res.json();
      console.log("[LOGIN] backend response:", data);
      if (res.status === 401 || data.error) {
        const adminIdMissing = data.requireItAdminId || data.requireUserId || data.errorCode === "ADMIN_IT_ADMIN_ID_REQUIRED" || data.errorCode === "ADMIN_USER_ID_REQUIRED";
        if (!adminIdRequired && adminIdMissing) {
          setIsLoading(false);
          setErrorMessage("Super Admin accounts must use the Admin Login and provide their Super Admin ID.");
          setShowErrorModal(true);
          if (redirectTimerRef.current) {
            clearTimeout(redirectTimerRef.current);
          }
          redirectTimerRef.current = setTimeout(() => {
            router.push(`/auth/adminlogin?email=${encodeURIComponent(email)}`);
          }, 1500);
          return;
        }
        setErrorMessage(data.error || DEFAULT_LOGIN_ERROR_MESSAGE);
        setShowErrorModal(true);
      } else {
        const resolvedRedirectPath = data.redirectPath || resolveWelcomePath(data.role);

        if (data.skipOtp) {
          storeUserProfile({
            firstName: data.first_name,
            middleName: data.middle_name,
            lastName: data.last_name,
            role: data.role,
            userId: data.user_id,
            email: data.email ?? email,
          });
          try {
            sessionStorage.setItem("wasLoggedOut", "false");
          } catch (storageError) {
            console.warn("Unable to persist logout marker", storageError);
          }
          // Device is trusted, redirect to welcome page
          const welcomePath = resolvedRedirectPath;
          console.log("[LOGIN] redirecting to:", welcomePath);
          const normalizedRole = normalizeRole(data.role);
          if (["parent", "super_admin", "superadmin", "admin", "it_admin", "itadmin"].includes(normalizedRole)) {
            window.location.replace(welcomePath);
            return;
          }
          router.push(welcomePath);
        } else {
          clearStoredUserProfile();
          // Device not trusted, redirect to verification page
          const params = new URLSearchParams({
            email,
            role: data.role || "",
            user_id: data.user_id || "",
            redirect_path: resolvedRedirectPath,
          }).toString();
          console.log("[LOGIN] redirecting to verification with params:", params);
          router.push(`/auth/verification?${params}`);
        }
      }
    } catch (err) {
      setErrorMessage(DEFAULT_LOGIN_ERROR_MESSAGE);
      setShowErrorModal(true);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen text-[#013300] relative overflow-hidden scroll-smooth flex items-center justify-center bg-[#f6faf8]">
      {/* Soft, flat backgrounds for modern UI */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(198,238,216,0.34),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(212,242,225,0.3),transparent_24%),linear-gradient(180deg,rgba(251,254,252,0.98),rgba(244,250,246,0.96))]" />
      <div className="pointer-events-none absolute left-[12%] right-[50%] top-36 -z-10 h-48 rounded-3xl bg-linear-to-br from-green-100/40 via-white/40 to-transparent blur-4xl" />
      <div className="pointer-events-none absolute left-[56%] right-[12%] bottom-12 -z-10 h-48 rounded-[36px] bg-linear-to-t from-green-100/35 via-white/35 to-transparent blur-4xl" />

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-opacity-10 backdrop-blur">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full flex flex-col items-center">
            <h3 className="text-xl font-bold text-red-700 mb-4">Login Failed</h3>
            <p className="text-gray-800 mb-6 text-center">{errorMessage}</p>
            <button
              className="bg-green-700 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-900 transition"
              onClick={() => {
                setErrorMessage(DEFAULT_LOGIN_ERROR_MESSAGE);
                setShowErrorModal(false);
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      {/* Back Button */}
      <a
        href="/"
        className="absolute top-4 left-4 z-20 flex items-center text-green-900 hover:underline sm:top-6 sm:left-8 lg:top-8 lg:left-12"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M15.5 19L9 12L15.5 5" stroke="#013300" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="ml-1 text-base font-medium sm:text-lg">Back to Landing Page</span>
      </a>

      {/* MAIN CONTENT */}
      <div className="flex flex-col z-10 relative w-full max-w-md px-4 py-8 sm:max-w-2xl sm:px-6 md:flex-row md:max-w-6xl md:justify-between md:items-center md:px-8 lg:px-12">
        {/* Left Section */}
        <div className="flex flex-col justify-center items-center w-full mb-8 text-center md:w-1/2 md:items-start md:text-left md:mb-0 md:mr-12">
          <RPTLogoTitle />
          <p className="text-[#133000] text-base leading-relaxed mb-6 max-w-xs sm:text-lg sm:max-w-md md:text-xl md:max-w-none">
            Log in to streamline student progress tracking. Our platform simplifies remedial learning, helping teachers manage literacy and numeracy programs with ease.
          </p>
        </div>

        {/* Login Card */}
        <div className="flex flex-col justify-center items-center bg-white/90 rounded-3xl shadow-lg p-8 w-full sm:p-8 sm:max-w-md md:w-96 border border-green-50">
          <div className="w-full">
            <h2 className="text-2xl font-bold text-green-900 mb-2 text-center sm:text-3xl">Login</h2>
            
            {/* Platform description - concise version */}
            <div className="flex items-center justify-center mb-6 bg-green-50/80 py-2 px-3 rounded-lg border border-green-200/60 backdrop-blur-sm">
              <FaInfoCircle className="text-green-700 mr-2 shrink-0" />
              <p className="text-xs text-green-800 text-center">{infoMessage}</p>
            </div>

            <form onSubmit={handleLogin}>
              {adminIdRequired && (
                <div className="mb-3">
                  <label htmlFor="itAdminId" className="block text-sm font-medium text-[#013300] mb-1 sm:text-base">Super Admin ID</label>
                  <input
                    id="itAdminId"
                    type="text"
                    value={itAdminId}
                    onChange={e => setItAdminId(e.target.value)}
                    placeholder="Enter your Super Admin ID"
                    className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#013300] focus:border-transparent transition placeholder-gray-400 text-[#013300] sm:py-2"
                    required={adminIdRequired}
                  />
                </div>
              )}
              {/* Email Field */}
              <div className="mb-3">
                <label htmlFor="email" className="block text-sm font-medium text-[#013300] mb-1 sm:text-base">Email Address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#013300] focus:border-transparent transition placeholder-gray-400 text-[#013300] sm:py-2"
                  required
                />
                {email && email !== "admin" && !email.includes("@") && (
                  <div className="text-xs text-red-700 mt-1">Please enter a valid email address.</div>
                )}
              </div>

              {/* Password Field */}
              <div className="mb-3">
                <label htmlFor="password" className="block text-sm font-medium text-[#013300] mb-1 sm:text-base">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-2.5 pr-12 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#013300] focus:border-transparent transition placeholder-gray-400 text-[#013300] sm:py-2"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <FaEyeSlash className="h-5 w-5" /> : <FaEye className="h-5 w-5" />}
                  </button>
                </div>
                {verifying && password && <div className="text-xs text-yellow-700 mt-1">Verifying...</div>}
                {success && <div className="text-xs text-green-700 mt-1">Credentials match.</div>}
                {error && !verifying && password && <div className="text-xs text-red-700 mt-1">Credentials do not match.</div>}
              </div>

              {/* Forgot Password (moved here) */}
              <div className="mb-4 text-right text-sm sm:text-base">
                <a
                  href="/auth/forgot_password"
                  className="font-medium text-green-600 hover:text-green-500 underline"
                >
                  Forgot password?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !canSubmit}
                className="w-full bg-linear-to-r from-green-600 to-[#133000] text-white font-bold py-2.5 rounded-xl hover:opacity-90 transition shadow-md disabled:opacity-70 sm:py-2"
              >
                {isLoading ? "Logging in..." : "Login"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
