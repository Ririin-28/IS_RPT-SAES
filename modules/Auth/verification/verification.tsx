"use client";
import { useRouter, useSearchParams } from "next/navigation";
import VerificationForm from "./VerificationForm";
import { useCallback, Suspense, useEffect, useRef, useState } from "react";

const OTP_VERIFICATION_CONTEXT_KEY = "otpVerificationContext";

type VerificationFormProps = {
	email: string;
	user_id: string;
	role: string;
	redirectPath?: string;
	onVerified: (device_token: string, redirectPath?: string | null) => void;
};

const normalizeRole = (role: string | null | undefined): string => {
	if (!role) {
		return "";
	}
	return role
		.toLowerCase()
		.replace(/[\s/\-]+/g, "_");
};

function VerificationContent() {
	const router = useRouter();
	const params = useSearchParams();
	const hasConsumedSessionContextRef = useRef(false);
	const [verificationData, setVerificationData] = useState({
		email: "",
		user_id: "",
		role: "",
		redirectPath: "",
	});

	useEffect(() => {
		const emailFromQuery = params?.get("email") || "";
		const userIdFromQuery = params?.get("user_id") || "";
		const roleFromQuery = params?.get("role") || "";
		const redirectPathFromQuery = params?.get("redirect_path") || "";

		let email = emailFromQuery;
		let user_id = userIdFromQuery;
		let role = roleFromQuery;
		let redirectPath = redirectPathFromQuery;
		let consumedSessionContext = false;

		if (!email || !user_id) {
			try {
				const raw = sessionStorage.getItem(OTP_VERIFICATION_CONTEXT_KEY);
				if (raw) {
					const parsed = JSON.parse(raw) as {
						email?: string;
						user_id?: string;
						role?: string;
						redirect_path?: string;
					};
					email = parsed.email || email;
					user_id = parsed.user_id || user_id;
					role = parsed.role || role;
					redirectPath = parsed.redirect_path || redirectPath;
					consumedSessionContext = true;
				}
			} catch {
				// Ignore invalid session payload.
			}
		}

		setVerificationData((previous) => {
			const next = { email, user_id, role, redirectPath };
			const hasNextCoreData = Boolean(next.email && next.user_id);
			const hasPreviousData = Boolean(previous.email || previous.user_id || previous.role || previous.redirectPath);

			if (!hasNextCoreData && hasPreviousData) {
				return previous;
			}

			return next;
		});

		// Remove sensitive query params from browser URL if present.
		if (emailFromQuery || userIdFromQuery || roleFromQuery || redirectPathFromQuery) {
			window.history.replaceState(null, "", "/auth/verification");
		}

		if (consumedSessionContext && !hasConsumedSessionContextRef.current) {
			try {
				sessionStorage.removeItem(OTP_VERIFICATION_CONTEXT_KEY);
			} catch {
				// Ignore storage access issues.
			}
			hasConsumedSessionContextRef.current = true;
		}
	}, [params]);

	const resolveWelcomePath = useCallback((rawRole: string | null | undefined): string => {
		const normalized = normalizeRole(rawRole);
		switch (normalized) {
			case "super_admin":
			case "superadmin":
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

	const handleVerified = useCallback((device_token: string, apiRedirectPath?: string | null) => {
		localStorage.setItem("deviceToken", device_token);
		localStorage.setItem("device_token", device_token);
		try {
			sessionStorage.setItem("wasLoggedOut", "false");
		} catch (storageError) {
			console.warn("Unable to persist logout marker", storageError);
		}
		const fallbackPath = resolveWelcomePath(verificationData.role);
		const targetPath = apiRedirectPath || verificationData.redirectPath || fallbackPath;
		const normalizedRole = normalizeRole(verificationData.role);
		if (["parent", "super_admin", "superadmin", "admin", "it_admin", "itadmin"].includes(normalizedRole || "")) {
			window.location.replace(targetPath);
			return;
		}
		router.push(targetPath);
	}, [verificationData.redirectPath, verificationData.role, resolveWelcomePath, router]);

	return (
		<VerificationForm
			email={verificationData.email}
			user_id={verificationData.user_id}
			role={verificationData.role}
			redirectPath={verificationData.redirectPath}
			onVerified={handleVerified}
		/>
	);
}

export default function VerificationPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<VerificationContent />
		</Suspense>
	);
}
