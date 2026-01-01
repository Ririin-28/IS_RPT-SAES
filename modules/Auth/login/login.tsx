"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { FaEye, FaEyeSlash, FaInfoCircle } from "react-icons/fa";
import RPTLogoTitle from "@/components/Common/RPTLogoTitle";
import { clearOAuthState } from "@/lib/utils/clear-oauth-state";
import { getStoredUserProfile, storeUserProfile } from "@/lib/utils/user-profile";

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
  requireUserId?: boolean;
};

export default function Login({
  infoMessage = "For San Agustin Elementary School authorized accounts only.",
  requireUserId = false,
}: LoginProps = {}) {
  const [showErrorModal, setShowErrorModal] = useState(false);
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState(DEFAULT_LOGIN_ERROR_MESSAGE);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sanitizedUserId = useMemo(() => userId.trim(), [userId]);

  const resolveWelcomePath = useCallback((role: string | null | undefined): string => {
    const normalized = normalizeRole(role);
    switch (normalized) {
      case "it_admin":
      case "admin":
      case "itadmin":
        return "/IT_Admin/welcome";
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
    const hasValidUserId = sanitizedUserId && !Number.isNaN(Number(sanitizedUserId));
    const canVerify = requireUserId ? Boolean(email && password && hasValidUserId) : Boolean(email && password);
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
          userId: requireUserId ? sanitizedUserId : undefined,
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
  }, [email, password, requireUserId, sanitizedUserId]);

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
          router.push(resolveWelcomePath(storedProfile.role));
        }
      }
    };

    checkSession();
  }, [resolveWelcomePath, router]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (requireUserId) {
        if (!sanitizedUserId) {
          setErrorMessage("Please enter your numeric User ID to sign in.");
          setShowErrorModal(true);
          setIsLoading(false);
          return;
        }
        if (Number.isNaN(Number(sanitizedUserId))) {
          setErrorMessage("User ID must be a valid number.");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          userId: requireUserId ? sanitizedUserId : undefined,
          deviceToken,
          deviceName,
        }),
      });
      const data = await res.json();
      console.log("[LOGIN] backend response:", data);
      if (res.status === 401 || data.error) {
        if (!requireUserId && (data.requireUserId || data.errorCode === "ADMIN_USER_ID_REQUIRED")) {
          setIsLoading(false);
          setErrorMessage("IT Admin accounts must use the Admin Login and provide their User ID.");
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

        const resolvedRedirectPath = data.redirectPath || resolveWelcomePath(data.role);

        if (data.skipOtp) {
          // Device is trusted, redirect to welcome page
          const welcomePath = resolvedRedirectPath;
          console.log("[LOGIN] redirecting to:", welcomePath);
          const normalizedRole = normalizeRole(data.role);
          if (["parent", "admin", "it_admin", "itadmin"].includes(normalizedRole)) {
            window.location.replace(welcomePath);
            return;
          }
          router.push(welcomePath);
        } else {
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
    <div className="min-h-screen text-[#013300] relative overflow-hidden scroll-smooth flex items-center justify-center">
      {/* Background Styles - Same as Landing Page */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(209,255,222,0.45),_transparent_20%),radial-gradient(circle_at_bottom_right,_rgba(188,240,214,0.35),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(242,249,245,0.95))]" />
      <div className="pointer-events-none absolute left-[12%] right-[46%] top-40 -z-10 h-56 rounded-3xl bg-gradient-to-br from-green-200/50 via-white/40 to-transparent blur-4xl" />
      <div className="pointer-events-none absolute left-[52%] right-[12%] bottom-16 -z-10 h-56 rounded-[40px] bg-gradient-to-t from-green-200/60 via-white/35 to-transparent blur-4xl" />
      
      {/* Additional soft gradients for depth */}
      <div className="pointer-events-none absolute left-[5%] top-[20%] -z-10 h-48 w-48 rounded-full bg-gradient-to-br from-green-300/50 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute right-[8%] bottom-[25%] -z-10 h-56 w-56 rounded-full bg-gradient-to-tl from-green-200/90 to-transparent blur-3xl" />

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
        <div className="flex flex-col justify-center items-center bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 w-full sm:p-6 sm:max-w-md md:w-96 border border-green-100/60">
          <div className="w-full">
            <h2 className="text-2xl font-bold text-green-900 mb-2 text-center sm:text-3xl">Login</h2>
            
            {/* Platform description - concise version */}
            <div className="flex items-center justify-center mb-6 bg-green-50/80 py-2 px-3 rounded-lg border border-green-200/60 backdrop-blur-sm">
              <FaInfoCircle className="text-green-700 mr-2 flex-shrink-0" />
              <p className="text-xs text-green-800 text-center">{infoMessage}</p>
            </div>

            <form onSubmit={handleLogin}>
              {requireUserId && (
                <div className="mb-3">
                  <label htmlFor="userId" className="block text-sm font-medium text-[#013300] mb-1 sm:text-base">User ID</label>
                  <input
                    id="userId"
                    type="text"
                    inputMode="numeric"
                    value={userId}
                    onChange={e => setUserId(e.target.value)}
                    placeholder="Enter your user ID"
                    className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#013300] focus:border-transparent transition placeholder-gray-400 text-[#013300] sm:py-2"
                    required={requireUserId}
                  />
                  {sanitizedUserId && Number.isNaN(Number(sanitizedUserId)) && (
                    <div className="text-xs text-red-700 mt-1">User ID must be a valid number.</div>
                  )}
                </div>
              )}
              {/* Email Field */}
              <div className="mb-3">
                <label htmlFor="email" className="block text-sm font-medium text-[#013300] mb-1 sm:text-base">Email Address</label>
                <input
                  id="email"
                  type="text"
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
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-green-600 to-[#133000] text-white font-bold py-2.5 rounded-lg hover:opacity-90 transition shadow-md disabled:opacity-70 sm:py-2"
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