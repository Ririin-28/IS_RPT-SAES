"use client";
import { useRouter, useSearchParams } from "next/navigation";
import VerificationForm from "./VerificationForm";
import { useCallback, Suspense } from "react";

type VerificationFormProps = {
	email: string;
	user_id: string;
	role: string;
	onVerified: (device_token: string) => void;
};

function VerificationContent() {
	const router = useRouter();
	const params = useSearchParams();
	let email = "";
	let user_id = "";
	let role = "";
	if (params) {
		email = params.get("email") || "";
		user_id = params.get("user_id") || "";
		role = params.get("role") || "";
	}

	const resolveWelcomePath = useCallback((rawRole: string | null | undefined): string => {
		const normalized = (rawRole ?? "").toLowerCase();
		switch (normalized) {
			case "it_admin":
			case "admin":
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

	const handleVerified = useCallback((device_token: string) => {
		localStorage.setItem("device_token", device_token);
		const path = resolveWelcomePath(role);
		router.push(path);
	}, [resolveWelcomePath, role, router]);

	return (
		<VerificationForm email={email} user_id={user_id} role={role} onVerified={handleVerified} />
	);
}

export default function VerificationPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<VerificationContent />
		</Suspense>
	);
}
