"use client";
import { useEffect, useState } from "react";

interface VerificationFormProps {
  email: string;
  user_id: string;
  role: string;
  onVerified: (device_token: string) => void;
}

export default function VerificationForm({ email, user_id, role, onVerified }: VerificationFormProps) {

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendDisabled, setSendDisabled] = useState(false);

  const sendOtp = async () => {
    if (sendDisabled || loading) {
      return;
    }

    setSendDisabled(true);
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, user_id }),
      });
      const data = await res.json();

      if (data.success) {
        setOtpSent(true);
      } else {
        setError("Failed to send OTP. Please try again.");
        setSendDisabled(false);
      }
    } catch (err) {
      setError("Failed to send OTP. Please try again.");
      setSendDisabled(false);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp, deviceName: navigator.userAgent }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      localStorage.setItem("deviceToken", data.deviceToken);
      onVerified(data.deviceToken);
    } else {
      setError(data.error || "Invalid OTP or expired. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-200 relative overflow-hidden md:py-8">
      <div className="flex flex-col justify-center items-center bg-white rounded-3xl shadow-xl p-6 w-full sm:p-6 sm:max-w-md md:w-96">
        <div className="w-full">
          <h2 className="text-2xl font-bold text-green-900 mb-6 text-center sm:text-3xl sm:mb-6">Device Verification</h2>
          <p className="mb-2 text-black text-center">An OTP will be sent to your email: <b>{email}</b></p>
          {!otpSent ? (
            <button
              type="button"
              onClick={sendOtp}
              disabled={loading || sendDisabled}
              className="w-full bg-gradient-to-r from-green-600 to-[#133000] text-white font-bold py-2.5 rounded-lg hover:opacity-90 transition shadow-md disabled:opacity-70 sm:py-2 mb-4"
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          ) : (
            <form onSubmit={verifyOtp}>
              <label htmlFor="otp" className="block text-sm font-medium text-[#013300] mb-1 sm:text-base">Enter OTP</label>
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP"
                className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#013300] focus:border-transparent transition placeholder-gray-400 text-[#013300] sm:py-2 mb-3"
                required
                maxLength={6}
              />
              <div className="text-xs text-gray-700 mb-2">OTP expires in 5 minutes.</div>
              {error && <div className="text-xs text-red-700 mb-2">{error}</div>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-[#133000] text-white font-bold py-2.5 rounded-lg hover:opacity-90 transition shadow-md disabled:opacity-70 sm:py-2"
              >
                {loading ? "Verifying..." : "Verify"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
