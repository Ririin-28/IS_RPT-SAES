"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import EnglishFlashcards from "@/components/Common/EnglishFlashcards/EnglishFlashcards";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

const PERFORMANCE_HISTORY_KEY = "TEACHER_ENGLISH_PERFORMANCE";

type StudentRecord = {
	id: string;
	studentId: string;
	name: string;
	grade?: string;
	section?: string;
	phonemicLevel?: string;
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
	suffix?: string | null;
	nameSuffix?: string | null;
	fullName: string | null;
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
	sentence: string;
	score?: number;
	responseTime?: number;
	cardIndex: number;
	question?: string;
};

const normalizeLevelLabel = (value?: string | null): string => {
	if (!value) return "";
	return value.toLowerCase().replace(/[^a-z0-9]/g, "");
};

const KNOWN_SUFFIXES = new Set([
	"jr",
	"jr.",
	"sr",
	"sr.",
	"ii",
	"iii",
	"iv",
	"v",
	"vi",
	"vii",
	"viii",
	"ix",
	"x",
]);

const formatSuffix = (value: string): string => {
	const trimmed = value.trim();
	if (!trimmed) return "";
	const lower = trimmed.toLowerCase();
	if (lower === "jr" || lower === "jr.") return "Jr.";
	if (lower === "sr" || lower === "sr.") return "Sr.";
	if (KNOWN_SUFFIXES.has(lower)) return trimmed.toUpperCase();
	return trimmed;
};

const formatStudentNameFromString = (value: string): string => {
	const trimmed = value.trim();
	if (!trimmed) return "";

	if (trimmed.includes(",")) {
		const commaParts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
		const last = commaParts[0] ?? "";
		const firstAndMiddle = commaParts[1] ?? "";
		const firstParts = firstAndMiddle.split(/\s+/).filter(Boolean);
		const first = firstParts[0] ?? "";
		let suffixRaw = "";
		let middleFromComma = "";
		if (commaParts.length > 2) {
			const possibleSuffix = commaParts[commaParts.length - 1];
			if (KNOWN_SUFFIXES.has(possibleSuffix.toLowerCase())) {
				suffixRaw = possibleSuffix;
				middleFromComma = commaParts.slice(2, -1).join(" ");
			} else {
				middleFromComma = commaParts.slice(2).join(" ");
			}
		}
		const middle = [...firstParts.slice(1), ...middleFromComma.split(/\s+/).filter(Boolean)].join(" ");
		const middleInitial = middle ? `${middle[0].toUpperCase()}.` : "";
		const suffix = formatSuffix(suffixRaw);
		if (!last || !first) return trimmed;
		return `${last}, ${first}${middleInitial ? ` ${middleInitial}` : ""}${suffix ? `, ${suffix}` : ""}`;
	}

	const parts = trimmed.split(/\s+/).filter(Boolean);
	if (parts.length < 2) return trimmed;
	const lastPart = parts[parts.length - 1];
	const suffix = KNOWN_SUFFIXES.has(lastPart.toLowerCase()) ? formatSuffix(lastPart) : "";
	const nameParts = suffix ? parts.slice(0, -1) : parts;
	if (nameParts.length < 2) return trimmed;
	const first = nameParts[0];
	const last = nameParts[nameParts.length - 1];
	const middle = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "";
	const middleInitial = middle ? `${middle[0].toUpperCase()}.` : "";
	if (!last || !first) return trimmed;
	return `${last}, ${first}${middleInitial ? ` ${middleInitial}` : ""}${suffix ? `, ${suffix}` : ""}`;
};

export default function TeacherEnglishFlashcards() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const selectedStudentId = searchParams?.get("studentId") || null;
	const phonemicNameParam = searchParams?.get("phonemicName") ?? "";
	const [students, setStudents] = useState<StudentRecord[]>([]);
	const expectedPhonemicLevel = useMemo(
		() => normalizeLevelLabel(phonemicNameParam),
		[phonemicNameParam],
	);
	const filteredStudents = useMemo(() => {
		if (!expectedPhonemicLevel) return students;
		return students.filter((student) =>
			normalizeLevelLabel(student.phonemicLevel) === expectedPhonemicLevel,
		);
	}, [expectedPhonemicLevel, students]);
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

	const formatStudentDisplayName = (student: RemedialStudent): string => {
		const last = (student.lastName ?? "").trim();
		const first = (student.firstName ?? "").trim();
		const middle = (student.middleName ?? "").trim();
		const suffix = formatSuffix((student.suffix ?? student.nameSuffix ?? "").trim());
		if (last || first) {
			const middleInitial = middle ? `${middle[0].toUpperCase()}.` : "";
			const core = `${last}${last && first ? ", " : ""}${first}${middleInitial ? ` ${middleInitial}` : ""}`;
			return `${core}${suffix ? `, ${suffix}` : ""}`.trim();
		}
		return formatStudentNameFromString(student.fullName ?? composeDisplayName(student));
	};

	const toDisplayStudent = (student: RemedialStudent, index: number): StudentRecord => {
		const numericUserId = coerceNumber(student.userId);
		const numericRemedialId = coerceNumber(student.remedialId);
		const rawStudentId = typeof student.studentId === "string" && student.studentId.trim().length
			? student.studentId.trim()
			: coerceNumber(student.studentId) !== null
				? String(coerceNumber(student.studentId))
				: null;

		const fallbackId = rawStudentId
			?? (numericUserId !== null
				? `U-${numericUserId}`
				: (numericRemedialId !== null ? `R-${numericRemedialId}` : String(index + 1)));
		const trimmedIdentifier = student.studentIdentifier?.trim();
		const identifier = rawStudentId ?? (trimmedIdentifier?.length ? trimmedIdentifier : fallbackId);

		return {
			id: fallbackId,
			studentId: identifier,
			name: formatStudentDisplayName(student),
			grade: student.grade ?? "",
			section: student.section ?? "",
			phonemicLevel: student.english ?? "",
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
				const response = await fetch(`/api/teacher/remedial/students?${params.toString()}`, {
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
				console.warn("Failed to load english remedial roster", error);
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
			console.warn("Failed to load english remedial performance history", error);
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
			students={filteredStudents}
			performances={performances}
			onSavePerformance={handleSavePerformance}
			initialView={selectedStudentId ? "session" : undefined}
			initialStudentId={selectedStudentId ?? undefined}
			forceSessionOnly={Boolean(selectedStudentId)}
			onExit={() => router.back()}
		/>
	);
}
