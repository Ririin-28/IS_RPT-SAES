"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import EnglishFlashcards from "@/components/Common/EnglishFlashcards/EnglishFlashcards";
import FilipinoFlashcards from "@/components/Common/FilipinoFlashcards/FilipinoFlashcards";
import MathFlashcards from "@/components/Common/MathFlashcards/MathFlashcards";
import { normalizeMaterialSubject, type MaterialSubject } from "@/lib/materials/shared";
import { buildFlashcardContentKey } from "@/lib/utils/flashcards-storage";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

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

const hasRenderableFlashcards = (value: unknown, subject: MaterialSubject): value is unknown[] => {
	if (!Array.isArray(value) || value.length === 0) {
		return false;
	}

	return value.some((entry) => {
		if (!entry || typeof entry !== "object") {
			return false;
		}

		if (subject === "Math") {
			const question = (entry as { question?: unknown }).question;
			return typeof question === "string" && question.trim().length > 0;
		}

		const sentence = (entry as { sentence?: unknown }).sentence;
		return typeof sentence === "string" && sentence.trim().length > 0;
	});
};

const readStoredFlashcards = (storageKey: string | null, subject: MaterialSubject | null): unknown[] | null => {
	if (typeof window === "undefined" || !storageKey || !subject) {
		return null;
	}

	try {
		const stored = window.localStorage.getItem(storageKey);
		if (!stored) {
			return null;
		}

		const parsed = JSON.parse(stored);
		return hasRenderableFlashcards(parsed, subject) ? parsed : null;
	} catch {
		return null;
	}
};

export default function MasterTeacherCoordinatorRemedialFlashcards() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const urlSubject = normalizeMaterialSubject(searchParams?.get("subject"));
	const [subject, setSubject] = useState<MaterialSubject | null>(() => urlSubject ?? null);
	const [isFetchingContent, setIsFetchingContent] = useState(false);
	const [contentError, setContentError] = useState<string | null>(null);
	const [contentVersion, setContentVersion] = useState(0);

	// Get subject and phonemic info from URL parameter first
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
	const contentStorageKey = useMemo(() => {
		if (!subject) {
			return null;
		}

		const baseKey = SUBJECT_FLASHCARD_KEYS[subject];
		return buildFlashcardContentKey(baseKey, {
			activityId,
			phonemicId,
			userId,
		});
	}, [activityId, phonemicId, subject, userId]);
	const storedFlashcards = useMemo(() => {
		void contentVersion;
		return readStoredFlashcards(contentStorageKey, subject);
	}, [contentStorageKey, contentVersion, subject]);

	useEffect(() => {
		// If subject is in URL, use it immediately
		if (urlSubject) {
			setSubject((current) => (current === urlSubject ? current : urlSubject));
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
					"/api/master_teacher/coordinator/profile",
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
	}, [urlSubject, userId]);

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			if (typeof window === "undefined") return;
			if (!subject) return;

			if (!activityId || !phonemicId) {
				const baseKey = SUBJECT_FLASHCARD_KEYS[subject];
				if (baseKey) {
					window.localStorage.removeItem(baseKey);
					if (contentStorageKey) {
						window.localStorage.removeItem(contentStorageKey);
					}
				}
				if (!cancelled) {
					setContentError("Missing activity or phonemic level.");
					setIsFetchingContent(false);
				}
				return;
			}

			if (storedFlashcards) {
				if (!cancelled) {
					setContentError(null);
					setIsFetchingContent(false);
				}
				return;
			}

			setIsFetchingContent(true);
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

				// Transform data for Math subject to match MathFlashcards expectation
				let contentToStore = cards;
				if (subject === "Math") {
					contentToStore = cards.map((card: any) => ({
						question: card.sentence ?? "",
						correctAnswer: card.answer ?? ""
					}));
				}
				
				if (contentStorageKey) {
					window.localStorage.setItem(contentStorageKey, JSON.stringify(contentToStore));
					if (!cancelled) {
						setContentVersion((version) => version + 1);
					}
				}
			} catch (error) {
				if (!cancelled) {
					setContentError(error instanceof Error ? error.message : "Failed to load content");
				}
			} finally {
				if (!cancelled) {
					setIsFetchingContent(false);
				}
			}
		};

		void load();
		return () => {
			cancelled = true;
		};
	}, [activityId, contentStorageKey, phonemicId, storedFlashcards, subject]);


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
	const noopEnglishSave = useMemo(() => (() => undefined), []);
	const noopMathSave = useMemo(() => (() => undefined), []);

	if (!subject) {
		return (
			<div className="min-h-screen bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec] flex items-center justify-center p-6">
				<div className="w-full max-w-md rounded-3xl border border-white/80 bg-white/80 shadow-[0_24px_60px_-30px_rgba(1,51,0,0.35)] backdrop-blur-xl px-8 py-10 text-center">
					<div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#013300]/10 border-t-[#013300]" />
					<p className="text-lg font-semibold text-slate-900">Preparing remedial flashcards</p>
					<p className="mt-2 text-sm text-slate-600">Loading your assigned subject.</p>
				</div>
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

	if (!storedFlashcards || isFetchingContent) {
		return (
			<div className="min-h-screen bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec] flex items-center justify-center p-6">
				<div className="w-full max-w-md rounded-3xl border border-white/80 bg-white/80 shadow-[0_24px_60px_-30px_rgba(1,51,0,0.35)] backdrop-blur-xl px-8 py-10 text-center">
					<div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#013300]/10 border-t-[#013300]" />
					<p className="text-lg font-semibold text-slate-900">Preparing remedial flashcards</p>
					<p className="mt-2 text-sm text-slate-600">
						{isFetchingContent ? "Loading the approved flashcards for this session." : "Opening the session."}
					</p>
				</div>
			</div>
		);
	}

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
