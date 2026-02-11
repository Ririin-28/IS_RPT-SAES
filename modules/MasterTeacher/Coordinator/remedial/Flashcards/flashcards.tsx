"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import EnglishFlashcards from "@/components/Common/EnglishFlashcards/EnglishFlashcards";
import FilipinoFlashcards from "@/components/Common/FilipinoFlashcards/FilipinoFlashcards";
import MathFlashcards from "@/components/Common/MathFlashcards/MathFlashcards";
import { normalizeMaterialSubject, type MaterialSubject } from "@/lib/materials/shared";
import { buildFlashcardContentKey } from "@/lib/utils/flashcards-storage";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

const SUBJECT_FALLBACK: MaterialSubject = "English";

type StudentRecord = {
	id: string;
	studentId: string;
	name: string;
	grade?: string;
	section?: string;
};

const SUBJECT_FLASHCARD_KEYS: Record<MaterialSubject, string> = {
	English: "MASTER_TEACHER_ENGLISH_FLASHCARDS",
	Filipino: "MASTER_TEACHER_FILIPINO_FLASHCARDS",
	Math: "MASTER_TEACHER_MATH_FLASHCARDS",
};

export default function MasterTeacherCoordinatorRemedialFlashcards() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [subject, setSubject] = useState<MaterialSubject | null>(null);
	const [loadingContent, setLoadingContent] = useState(false);
	const [contentError, setContentError] = useState<string | null>(null);

	// Get subject and phonemic info from URL parameter first
	const urlSubject = searchParams?.get('subject') as MaterialSubject;
	const activityId = searchParams?.get("activity");
	const phonemicId = searchParams?.get("phonemicId");
	const phonemicName = searchParams?.get("phonemicName") || "";

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
		// If subject is in URL, use it immediately
		if (urlSubject && ["English", "Filipino", "Math"].includes(urlSubject)) {
			setSubject(urlSubject);
			return;
		}

		// Otherwise, fetch from coordinator profile
		if (typeof window === "undefined") return;
		if (!userId) {
			// Do not default to fallback if user is missing to avoid session cross-contamination
			setSubject(null);
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
				
				// Try multiple possible fields for the subject
				const subjectCandidate = payload.coordinator?.coordinatorSubject
					?? payload.coordinator?.subjectsHandled
					?? payload.coordinator?.subjectHandled
					?? null;
				
				console.log('Coordinator profile response:', payload);
				console.log('Subject candidate:', subjectCandidate);
				
				const resolvedSubject = normalizeMaterialSubject(subjectCandidate) ?? null;
				console.log('Resolved subject:', resolvedSubject);
				
				setSubject(resolvedSubject);
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") return;
				console.warn("Failed to load coordinator subject", error);
				setSubject(null);
			}
		};

		loadCoordinatorProfile();
		return () => controller.abort();
	}, [userId, urlSubject]);

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			if (typeof window === "undefined") return;
			if (!subject) return;

			if (!activityId || !phonemicId) {
				const baseKey = SUBJECT_FLASHCARD_KEYS[subject];
				if (baseKey) {
					window.localStorage.removeItem(baseKey);
					const scopedKey = buildFlashcardContentKey(baseKey, {
						activityId,
						phonemicId,
						userId,
					});
					window.localStorage.removeItem(scopedKey);
				}
				if (!cancelled) {
					setContentError("Missing activity or phonemic level.");
				}
				return;
			}
			setLoadingContent(true);
			setContentError(null);
			try {
				const response = await fetch(
					`/api/remedial-material-content?requestId=${encodeURIComponent(activityId)}&phonemicId=${encodeURIComponent(phonemicId)}`,
					{ cache: "no-store" },
				);
				const payload = await response.json().catch(() => null);
				if (!response.ok || !payload?.success || !payload?.found) {
					if (!cancelled) {
						setContentError("No approved content found for this activity.");
					}
					return;
				}

				const cards = payload.content?.flashcardsOverride ?? payload.content?.flashcards;
				if (!Array.isArray(cards) || cards.length === 0) {
					if (!cancelled) {
						setContentError("No extracted flashcards found.");
					}
					return;
				}

				const baseKey = SUBJECT_FLASHCARD_KEYS[subject];
				const storageKey = baseKey
					? buildFlashcardContentKey(baseKey, {
							activityId,
							phonemicId,
							userId,
					  })
					: null;
				
				// Transform data for Math subject to match MathFlashcards expectation
				let contentToStore = cards;
				if (subject === "Math") {
					contentToStore = cards.map((card: any) => ({
						question: card.sentence ?? "",
						correctAnswer: card.answer ?? ""
					}));
				}
				
				if (storageKey) {
					window.localStorage.setItem(storageKey, JSON.stringify(contentToStore));
				}
			} catch (error) {
				if (!cancelled) {
					setContentError(error instanceof Error ? error.message : "Failed to load content");
				}
			} finally {
				if (!cancelled) {
					setLoadingContent(false);
				}
			}
		};

		void load();
		return () => {
			cancelled = true;
		};
	}, [activityId, phonemicId, subject, userId]);


	// Compose the header label with phonemicName if present
	const previewHeaderLabel = useMemo(() => {
		if (!subject) return "Preview";
		if (phonemicName) {
			return `${subject.toUpperCase()} • ${phonemicName.toUpperCase()} LEVEL`;
		}
		return `${subject} Preview`;
	}, [subject, phonemicName]);

	const previewStudent = useMemo<StudentRecord>(() => {
		return {
			id: `COORDINATOR_PREVIEW_${subject || 'UNKNOWN'}`,
			studentId: "PREVIEW",
			name: previewHeaderLabel,
			grade: "",
			section: "",
		};
	}, [subject, previewHeaderLabel]);

	const previewStudents = useMemo(() => [previewStudent], [previewStudent]);
	const noopEnglishSave = useMemo(() => (_entry: unknown) => undefined, []);
	const noopMathSave = useMemo(() => (_entry: unknown) => undefined, []);

	if (!subject) {
		return (
			<div className="h-screen flex items-center justify-center text-gray-500">
				Loading subject...
			</div>
		);
	}

	if (loadingContent) {
		return (
			<div className="h-screen flex items-center justify-center text-gray-500">
				Loading flashcards...
			</div>
		);
	}

	if (contentError) {
		return (
			<div className="h-screen flex flex-col items-center justify-center gap-3 text-gray-500 p-6">
				<p className="text-center">{contentError}</p>
				<button
					className="px-4 py-2 rounded bg-[#013300] text-white"
					onClick={() => router.push("/MasterTeacher/Coordinator/remedial")}
				>
					Back
				</button>
			</div>
		);
	}

	// Show the phonemic level name as a header above the flashcards
	const FlashcardsHeader = () => (
		<div className="w-full text-left px-4 pt-6 pb-2">
			{phonemicName && (
				<div className="text-xs font-bold tracking-widest text-green-900 uppercase mb-2">
					{phonemicName} Level
				</div>
			)}
			<div className="text-2xl font-bold text-green-900 mb-4">
				{subject} Preview
			</div>
		</div>
	);

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
				subject={subject}
				phonemicLevel={phonemicName ? `${phonemicName} Level` : undefined}
				activityTitle={`${subject} Preview`}
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
