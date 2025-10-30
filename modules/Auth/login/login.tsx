"use client";
import { useRouter } from "next/navigation";
import { getSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { FaEye, FaEyeSlash, FaInfoCircle } from "react-icons/fa";
import RPTLogoTitle from "@/components/Common/RPTLogoTitle";
import { clearOAuthState } from "@/lib/utils/clear-oauth-state";
import { storeUserProfile } from "@/lib/utils/user-profile";

export default function Login() {
  const [showErrorModal, setShowErrorModal] = useState(false);
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  
  // Live credential check
  useEffect(() => {
    let active = true;
    if (email && password) {
      setVerifying(true);
      setSuccess(false);
      setError(false);
      fetch("/api/auth/check-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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
  }, [email, password]);

  useEffect(() => {
    const checkSession = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const isLoggedOut = urlParams.get("logout") === "true";
      const hasError = urlParams.get("error");
      const wasLoggedOut = sessionStorage.getItem("wasLoggedOut") === "true";

      if (hasError === "OAuthCallback") {
        clearOAuthState();
        return;
      }

      if (isLoggedOut) {
        sessionStorage.setItem("wasLoggedOut", "true");
      }

      if (!isLoggedOut && !wasLoggedOut) {
        const session = await getSession();
        if (session) {
          router.push("/MasterTeacher/welcome");
        }
      }
    };

    checkSession();
  }, [router]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const deviceToken = localStorage.getItem("deviceToken") || "";
      const deviceName = navigator.userAgent;
      console.log("[LOGIN] deviceToken sent:", deviceToken);
      console.log("[LOGIN] deviceName sent:", deviceName);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, deviceToken, deviceName }),
      });
      const data = await res.json();
      console.log("[LOGIN] backend response:", data);
      if (res.status === 401 || data.error) {
        setShowErrorModal(true);
      } else {
        storeUserProfile({
          firstName: data.first_name,
          middleName: data.middle_name,
          lastName: data.last_name,
          role: data.role,
          userId: data.user_id,
        });

        if (data.skipOtp) {
          // Device is trusted, redirect to welcome page
          let welcomePath = "/";
          switch (data.role) {
            case "it_admin":
              welcomePath = "/IT_Admin/welcome";
              break;
            case "principal":
              welcomePath = "/Principal/welcome";
              break;
            case "parent":
              welcomePath = "/Parent/welcome";
              break;
            case "teacher":
              welcomePath = "/Teacher/welcome";
              break;
            case "masterteacher":
              welcomePath = "/MasterTeacher/welcome";
              break;
            default:
              welcomePath = "/";
          }
          console.log("[LOGIN] redirecting to:", welcomePath);
          router.push(welcomePath);
        } else {
          // Device not trusted, redirect to verification page
          const params = new URLSearchParams({
            email,
            role: data.role || "",
            user_id: data.user_id || "",
          }).toString();
          console.log("[LOGIN] redirecting to verification with params:", params);
          router.push(`/auth/verification?${params}`);
        }
      }
    } catch (err) {
      setShowErrorModal(true);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-200 relative overflow-hidden md:py-8">
      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-opacity-10 backdrop-blur">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full flex flex-col items-center">
            <h3 className="text-xl font-bold text-red-700 mb-4">Login Failed</h3>
            <p className="text-gray-800 mb-6 text-center">Email and password do not match our records. Please try again.</p>
            <button
              className="bg-green-700 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-900 transition"
              onClick={() => setShowErrorModal(false)}
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

      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none select-none">
        <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-green-300 blur-xl sm:left-20 sm:w-40 sm:h-40 lg:left-32 lg:w-48 lg:h-48"></div>
        <div className="absolute bottom-20 right-10 w-48 h-48 rounded-full bg-green-200 blur-xl sm:right-20 sm:w-60 sm:h-60 lg:right-32 lg:w-72 lg:h-72"></div>
      </div>

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
        <div className="flex flex-col justify-center items-center bg-white rounded-3xl shadow-xl p-6 w-full sm:p-6 sm:max-w-md md:w-96">
          <div className="w-full">
            <h2 className="text-2xl font-bold text-green-900 mb-2 text-center sm:text-3xl">Login</h2>
            
            {/* Platform description - concise version */}
            <div className="flex items-center justify-center mb-6 bg-green-50 py-2 px-3 rounded-lg border border-green-200">
              <FaInfoCircle className="text-green-700 mr-2 flex-shrink-0" />
              <p className="text-xs text-green-800 text-center">
                For San Agustin Elementary School authorized accounts only.
              </p>
            </div>

            <form onSubmit={handleLogin}>
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