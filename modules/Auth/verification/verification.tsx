"use client";
import { useRouter, useSearchParams } from "next/navigation";
import VerificationForm from "./VerificationForm";
import { useCallback, Suspense } from "react";

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
	let email = "";
	let user_id = "";
	let role = "";
	let redirectPath = "";
	if (params) {
		email = params.get("email") || "";
		user_id = params.get("user_id") || "";
		role = params.get("role") || "";
		redirectPath = params.get("redirect_path") || "";
	}

	const resolveWelcomePath = useCallback((rawRole: string | null | undefined): string => {
		const normalized = normalizeRole(rawRole);
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

	const handleVerified = useCallback((device_token: string, apiRedirectPath?: string | null) => {
		localStorage.setItem("deviceToken", device_token);
		localStorage.setItem("device_token", device_token);
		try {
			sessionStorage.setItem("wasLoggedOut", "false");
		} catch (storageError) {
			console.warn("Unable to persist logout marker", storageError);
		}
		const fallbackPath = resolveWelcomePath(role);
		const targetPath = apiRedirectPath || redirectPath || fallbackPath;
		const normalizedRole = normalizeRole(role);
		if (["parent", "admin", "it_admin", "itadmin"].includes(normalizedRole || "")) {
			window.location.replace(targetPath);
			return;
		}
		router.push(targetPath);
	}, [redirectPath, resolveWelcomePath, role, router]);

	return (
		<VerificationForm email={email} user_id={user_id} role={role} redirectPath={redirectPath} onVerified={handleVerified} />
	);
}

export default function VerificationPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<VerificationContent />
		</Suspense>
	);
}
