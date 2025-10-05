"use client";
import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useRouter } from "next/navigation";
import RPTLogoTitle from "@/components/Common/RPTLogoTitle";

export default function ForgotPassword() {
	const [step, setStep] = useState<"email"|"otp"|"reset">("email");
	const [email, setEmail] = useState("");
	const [otp, setOtp] = useState("");
	const [otpSent, setOtpSent] = useState(false);
	const [otpError, setOtpError] = useState("");
	const [otpLoading, setOtpLoading] = useState(false);
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [resetError, setResetError] = useState("");
	const [resetSuccess, setResetSuccess] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const router = useRouter();

	// Step 1: Send OTP
	const handleSendOtp = async (e: React.FormEvent) => {
		e.preventDefault();
		setOtpLoading(true);
		setOtpError("");
		try {
			const res = await fetch("/api/forgot_password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ step: "send_otp", email }),
			});
			const data = await res.json();
			if (data.success) {
				setOtpSent(true);
				setStep("otp");
			} else {
				setOtpError(data.message || "Failed to send OTP.");
			}
		} catch {
			setOtpError("Failed to send OTP.");
		}
		setOtpLoading(false);
	};

	// Step 2: Verify OTP
	const handleVerifyOtp = async (e: React.FormEvent) => {
		e.preventDefault();
		setOtpLoading(true);
		setOtpError("");
		try {
			const res = await fetch("/api/forgot_password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ step: "verify_otp", email, otp }),
			});
			const data = await res.json();
			if (data.success) {
				setStep("reset");
			} else {
				setOtpError(data.message || "Invalid OTP.");
			}
		} catch {
			setOtpError("Failed to verify OTP.");
		}
		setOtpLoading(false);
	};

	// Step 3: Reset Password
	const handleResetPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setResetError("");
		if (newPassword !== confirmPassword) {
			setResetError("Passwords do not match.");
			setIsLoading(false);
			return;
		}
		try {
			const res = await fetch("/api/forgot_password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ step: "reset_password", email, newPassword }),
			});
			const data = await res.json();
			if (data.success) {
				setResetSuccess(true);
				setTimeout(() => router.push("/auth/login"), 2000);
			} else {
				setResetError(data.message || "Failed to reset password.");
			}
		} catch {
			setResetError("Failed to reset password.");
		}
		setIsLoading(false);
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-200 relative overflow-hidden md:py-8">
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
						Forgot your password? Enter your email to receive a one-time password (OTP) and reset your account.
					</p>
				</div>

				{/* Forgot Password Card */}
				<div className="flex flex-col justify-center items-center bg-white rounded-3xl shadow-xl p-6 w-full sm:p-6 sm:max-w-md md:w-96">
					<div className="w-full">
						<h2 className="text-2xl font-bold text-green-900 mb-6 text-center sm:text-3xl sm:mb-6">Forgot Password</h2>

						{step === "email" && (
							<form onSubmit={handleSendOtp}>
								<div className="mb-4">
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
								</div>
								<div className="mb-4 text-green-800 text-sm text-center">An OTP will be sent to your email.</div>
								<button
									type="submit"
									disabled={otpLoading}
									className="w-full bg-gradient-to-r from-green-600 to-[#133000] text-white font-bold py-2.5 rounded-lg hover:opacity-90 transition shadow-md disabled:opacity-70 sm:py-2"
								>
									{otpLoading ? "Sending..." : "Send OTP"}
								</button>
								{otpError && <div className="text-red-700 text-sm mt-2 text-center">{otpError}</div>}
							</form>
						)}

						{step === "otp" && (
							<form onSubmit={handleVerifyOtp}>
								<div className="mb-4">
									<label htmlFor="otp" className="block text-sm font-medium text-[#013300] mb-1 sm:text-base">Enter OTP</label>
									<input
										id="otp"
										type="text"
										value={otp}
										onChange={e => setOtp(e.target.value)}
										placeholder="Enter the OTP sent to your email"
										className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#013300] focus:border-transparent transition placeholder-gray-400 text-[#013300] sm:py-2"
										required
									/>
								</div>
								<button
									type="submit"
									disabled={otpLoading}
									className="w-full bg-gradient-to-r from-green-600 to-[#133000] text-white font-bold py-2.5 rounded-lg hover:opacity-90 transition shadow-md disabled:opacity-70 sm:py-2"
								>
									{otpLoading ? "Verifying..." : "Verify OTP"}
								</button>
								{otpError && <div className="text-red-700 text-sm mt-2 text-center">{otpError}</div>}
							</form>
						)}

						{step === "reset" && (
							<form onSubmit={handleResetPassword}>
								<div className="mb-3">
									<label htmlFor="newPassword" className="block text-sm font-medium text-[#013300] mb-1 sm:text-base">New Password</label>
									<div className="relative">
										<input
											id="newPassword"
											type={showNewPassword ? "text" : "password"}
											value={newPassword}
											onChange={e => setNewPassword(e.target.value)}
											placeholder="Enter new password"
											className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#013300] focus:border-transparent transition placeholder-gray-400 text-[#013300] sm:py-2 pr-10"
											required
										/>
										<button
											type="button"
											onClick={() => setShowNewPassword((prev) => !prev)}
											className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-600 focus:outline-none"
										>
											{showNewPassword ? <FaEyeSlash className="h-5 w-5" /> : <FaEye className="h-5 w-5" />}
										</button>
									</div>
								</div>
								<div className="mb-4">
									<label htmlFor="confirmPassword" className="block text-sm font-medium text-[#013300] mb-1 sm:text-base">Confirm New Password</label>
									<div className="relative">
										<input
											id="confirmPassword"
											type={showConfirmPassword ? "text" : "password"}
											value={confirmPassword}
											onChange={e => setConfirmPassword(e.target.value)}
											placeholder="Confirm new password"
											className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#013300] focus:border-transparent transition placeholder-gray-400 text-[#013300] sm:py-2 pr-10"
											required
										/>
										<button
											type="button"
											onClick={() => setShowConfirmPassword((prev) => !prev)}
											className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-600 focus:outline-none"
										>
											{showConfirmPassword ? <FaEyeSlash className="h-5 w-5" /> : <FaEye className="h-5 w-5" />}
										</button>
									</div>
								</div>
								<button
									type="submit"
									disabled={isLoading}
									className="w-full bg-gradient-to-r from-green-600 to-[#133000] text-white font-bold py-2.5 rounded-lg hover:opacity-90 transition shadow-md disabled:opacity-70 sm:py-2"
								>
									{isLoading ? "Resetting..." : "Submit"}
								</button>
								{resetError && <div className="text-red-700 text-sm mt-2 text-center">{resetError}</div>}
								{resetSuccess && <div className="text-green-700 text-sm mt-2 text-center">Password reset successful! Redirecting to login...</div>}
							</form>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}