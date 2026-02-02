"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import EnglishFlashcards from "@/components/Common/EnglishFlashcards/EnglishFlashcards";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

const PERFORMANCE_HISTORY_KEY = "MASTER_TEACHER_ENGLISH_PERFORMANCE";

type StudentRecord = {
	id: string;
	studentId: string;
	name: string;
	grade?: string;
	section?: string;
};

type StudentPerformanceEntry = {
	id: string;
	studentId: string;
	timestamp: string;
	pronScore: number;
	fluencyScore: number;
	phonemeAccuracy: number;
	wpm: number;
	correctness?: number;
	readingSpeedScore?: number;
	readingSpeedLabel?: string;
	wordCount?: number;
	cardIndex: number;
	sentence: string;
};

type RemedialStudent = {
	studentId: string | number | null;
	userId: number | null;
	remedialId: number | null;
	studentIdentifier: string | null;
	grade: string | null;
	section: string | null;
	english: string | null;
	firstName: string | null;
	middleName: string | null;
	lastName: string | null;
	fullName: string | null;
};

export default function MasterTeacherEnglishRemedialFlashcards() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const selectedStudentId = searchParams?.get("studentId") || null;
	const [students, setStudents] = useState<StudentRecord[]>([]);
	const [performances, setPerformances] = useState<StudentPerformanceEntry[]>([]);
	const userProfile = useMemo(() => getStoredUserProfile(), []);
	const userId = useMemo(() => {
		const raw = userProfile?.userId;
		if (typeof raw === "number" && Number.isFinite(raw)) {
			return raw;
		}
		if (typeof raw === "string") {
			const parsed = Number.parseInt(raw, 10);
			if (Number.isFinite(parsed)) {
				return parsed;
			}
		}
		return null;
	}, [userProfile]);

	const coerceNumber = (value: unknown): number | null => {
		if (typeof value === "number" && Number.isFinite(value)) {
			return value;
		}
		if (typeof value === "string" && value.trim().length) {
			const parsed = Number.parseInt(value, 10);
			if (Number.isFinite(parsed)) {
				return parsed;
			}
		}
		return null;
	};

	const composeDisplayName = (student: RemedialStudent): string => {
		const explicitFullName = student.fullName?.trim();
		if (explicitFullName) return explicitFullName;

		const parts = [student.firstName, student.middleName, student.lastName]
			.map((part) => (part ?? "").trim())
			.filter((part) => part.length > 0);

		if (parts.length) return parts.join(" ");
		return "Unnamed Student";
	};

	const toDisplayStudent = (student: RemedialStudent, index: number): StudentRecord => {
		const numericUserId = coerceNumber(student.userId);
		const numericRemedialId = coerceNumber(student.remedialId);
		const rawStudentId = typeof student.studentId === "string" && student.studentId.trim().length
			? student.studentId.trim()
			: coerceNumber(student.studentId) !== null
				? String(coerceNumber(student.studentId))
				: null;

		const fallbackId = rawStudentId ?? (numericUserId !== null ? `U-${numericUserId}` : (numericRemedialId !== null ? `R-${numericRemedialId}` : String(index + 1)));
		const trimmedIdentifier = student.studentIdentifier?.trim();
		const identifier = rawStudentId ?? (trimmedIdentifier?.length ? trimmedIdentifier : fallbackId);

		return {
			id: fallbackId,
			studentId: identifier,
			name: student.fullName ?? composeDisplayName(student),
			grade: student.grade ?? "",
			section: student.section ?? "",
		};
	};

	useEffect(() => {
		if (typeof window === "undefined") return;

		if (userId === null) {
			setStudents([]);
			return;
		}

		const controller = new AbortController();
		const loadStudents = async () => {
			try {
				const params = new URLSearchParams({ userId: String(userId), subject: "english" });
				const response = await fetch(`/api/master_teacher/remedialteacher/students?${params.toString()}`, {
					method: "GET",
					cache: "no-store",
					signal: controller.signal,
				});

				if (!response.ok) {
					throw new Error(`Request failed with status ${response.status}`);
				}

				const payload = (await response.json()) as {
					success: boolean;
					students?: RemedialStudent[];
					error?: string;
				};

				if (!payload.success) {
					throw new Error(payload.error ?? "Failed to load students.");
				}

				const studentsData = Array.isArray(payload.students) ? payload.students : [];
				setStudents(studentsData.map(toDisplayStudent));
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") {
					return;
				}
				console.warn("Failed to load English remedial roster", error);
				setStudents([]);
			}
		};

		loadStudents();

		return () => {
			controller.abort();
		};
	}, [userId]);

	useEffect(() => {
		if (typeof window === "undefined") return;

		try {
			const storedPerformances = window.localStorage.getItem(PERFORMANCE_HISTORY_KEY);
			if (storedPerformances) {
				const parsed = JSON.parse(storedPerformances) as StudentPerformanceEntry[];
				if (Array.isArray(parsed)) {
					setPerformances(parsed);
				}
			}
		} catch (error) {
			console.warn("Failed to load English remedial performance history", error);
		}
	}, []);

	const handleSavePerformance = useCallback((entry: StudentPerformanceEntry) => {
		setPerformances((prev) => {
			const next = [...prev, entry];
			if (typeof window !== "undefined") {
				window.localStorage.setItem(PERFORMANCE_HISTORY_KEY, JSON.stringify(next));
			}
			return next;
		});
	}, []);

	return (
		<EnglishFlashcards
			students={students}
			performances={performances}
			onSavePerformance={handleSavePerformance}
			initialView={selectedStudentId ? "session" : undefined}
			initialStudentId={selectedStudentId ?? undefined}
			forceSessionOnly={Boolean(selectedStudentId)}
			onExit={() => router.back()}
		/>
	);
}
