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

	const handleVerified = useCallback((device_token: string) => {
		localStorage.setItem("device_token", device_token);
		let path = "/";
		switch (role) {
			case "admin": path = "/IT_Admin/welcome"; break;
			case "principal": path = "/Principal/welcome"; break;
			case "parent": path = "/Parent/welcome"; break;
			case "teacher": path = "/Teacher/welcome"; break;
			case "master_teacher": path = "/MasterTeacher/welcome"; break;
			default: path = "/";
		}
		router.push(path);
	}, [role, router]);

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
