"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import EnglishFlashcards from "@/components/Common/EnglishFlashcards/EnglishFlashcards";
import FilipinoFlashcards from "@/components/Common/FilipinoFlashcards/FilipinoFlashcards";
import MathFlashcards from "@/components/Common/MathFlashcards/MathFlashcards";
import { normalizeMaterialSubject, type MaterialSubject } from "@/lib/materials/shared";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

const SUBJECT_FALLBACK: MaterialSubject = "English";

type StudentRecord = {
	id: string;
	studentId: string;
	name: string;
	grade?: string;
	section?: string;
};

export default function MasterTeacherCoordinatorRemedialFlashcards() {
	const router = useRouter();
	const [subject, setSubject] = useState<MaterialSubject>(SUBJECT_FALLBACK);

	const userProfile = useMemo(() => getStoredUserProfile(), []);
	const userId = useMemo(() => {
		const raw = userProfile?.userId;
		if (typeof raw === "number" && Number.isFinite(raw)) return raw;
		if (typeof raw === "string") {
			const parsed = Number.parseInt(raw, 10);
			if (Number.isFinite(parsed)) return parsed;
		}
		return null;
	}, [userProfile]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (!userId) {
			setSubject(SUBJECT_FALLBACK);
			return;
		}

		const controller = new AbortController();
		const loadCoordinatorProfile = async () => {
			try {
				const response = await fetch(
					`/api/master_teacher/coordinator/profile?userId=${encodeURIComponent(String(userId))}`,
					{ cache: "no-store", signal: controller.signal },
				);
				const payload = await response.json().catch(() => null);
				if (!response.ok || !payload?.success) {
					throw new Error(payload?.error ?? "Unable to determine coordinator subject.");
				}
				const subjectCandidate = payload.coordinator?.coordinatorSubject
					?? payload.coordinator?.subjectsHandled
					?? payload.coordinator?.subjectHandled
					?? null;
				const resolvedSubject = normalizeMaterialSubject(subjectCandidate) ?? SUBJECT_FALLBACK;
				setSubject(resolvedSubject);
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") return;
				console.warn("Failed to load coordinator subject", error);
				setSubject(SUBJECT_FALLBACK);
			}
		};

		loadCoordinatorProfile();
		return () => controller.abort();
	}, [userId]);

	const previewStudent = useMemo<StudentRecord>(() => {
		const label = `${subject} Preview`;
		return {
			id: `COORDINATOR_PREVIEW_${subject}`,
			studentId: "PREVIEW",
			name: label,
			grade: "",
			section: "",
		};
	}, [subject]);

	const previewStudents = useMemo(() => [previewStudent], [previewStudent]);
	const noopEnglishSave = useMemo(() => (_entry: unknown) => undefined, []);
	const noopMathSave = useMemo(() => (_entry: unknown) => undefined, []);

	if (subject === "Math") {
		return (
			<MathFlashcards
				students={previewStudents}
				performances={[]}
				onSavePerformance={noopMathSave}
				initialView="session"
				initialStudentId={previewStudent.id}
				forceSessionOnly
				onExit={() => router.push("/MasterTeacher/Coordinator/remedial")}
			/>
		);
	}

	if (subject === "Filipino") {
		return (
			<FilipinoFlashcards
				students={previewStudents}
				performances={[]}
				onSavePerformance={noopEnglishSave}
				initialView="session"
				initialStudentId={previewStudent.id}
				forceSessionOnly
				onExit={() => router.push("/MasterTeacher/Coordinator/remedial")}
			/>
		);
	}

	return (
		<EnglishFlashcards
			students={previewStudents}
			performances={[]}
			onSavePerformance={noopEnglishSave}
			initialView="session"
			initialStudentId={previewStudent.id}
			forceSessionOnly
			onExit={() => router.push("/MasterTeacher/Coordinator/remedial")}
		/>
	);
}
