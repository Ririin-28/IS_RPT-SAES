"use client";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import TableList from "@/components/Common/Tables/TableList";
import FlashcardsTemplate, { MicIcon, Volume2Icon } from "@/components/Common/RemedialFlashcards/FlashcardsTemplate";

const PAGE_SIZE = 8;

/* ---------- String/phoneme utilities ---------- */
function levenshtein(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
	for (let i = 0; i <= m; i++) dp[i][0] = i;
	for (let j = 0; j <= n; j++) dp[0][j] = j;
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			dp[i][j] = Math.min(
				dp[i - 1][j] + 1,
				dp[i][j - 1] + 1,
				dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
			);
		}
	}
	return dp[m][n];
}

function normalizeText(value: string) {
	return value.replace(/[^a-zA-ZáéíóúñÑäëïöüÁÉÍÓÚÑ\s']/g, "").toLowerCase().trim();
}

function approxPhonemes(word: string) {
	if (!word) return [];
	const w = word.toLowerCase().replace(/[^a-záéíóúñ']/g, "");
	const vowels = ["a", "e", "i", "o", "u", "á", "é", "í", "ó", "ú"];
	const digraphs: Record<string, string> = {
		ng: "NG",
		ny: "NY",
		ts: "TS",
		dy: "DY",
		sy: "SY",
		ly: "LY",
		th: "T",
		sh: "S",
		ch: "CH",
		ph: "F",
		gh: "G",
	};

	let tmp = w;
	for (const key in digraphs) {
		tmp = tmp.split(key).join(` ${digraphs[key]} `);
	}

	const out: string[] = [];
	let buffer = "";
	for (let i = 0; i < tmp.length; i++) {
		const char = tmp[i];
		if (char === " ") {
			if (buffer) out.push(buffer);
			buffer = "";
			continue;
		}
		if (vowels.includes(char)) {
			if (buffer) {
				out.push(buffer);
				buffer = "";
			}
			let run = char;
			while (i + 1 < tmp.length && vowels.includes(tmp[i + 1])) {
				i++;
				run += tmp[i];
			}
			out.push(run.toUpperCase());
		} else {
			buffer += char.toUpperCase();
		}
	}
	if (buffer) out.push(buffer);
	return out.filter(Boolean);
}

function comparePhonemeArrays(expectedArr: string[], actualArr: string[]) {
	if (expectedArr.length === 0) return 0;
	let matches = 0;
	for (let i = 0; i < expectedArr.length; i++) {
		if (actualArr[i] === expectedArr[i]) matches++;
		else if (actualArr[i - 1] === expectedArr[i] || actualArr[i + 1] === expectedArr[i]) matches++;
	}
	return (matches / expectedArr.length) * 100;
}

/* ---------- Student roster & flashcards data ---------- */
const STUDENT_ROSTER_KEY = "MASTER_TEACHER_FILIPINO_STUDENTS";
const PERFORMANCE_HISTORY_KEY = "MASTER_TEACHER_FILIPINO_PERFORMANCE";

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
	cardIndex: number;
	sentence: string;
};

type EnrichedStudent = StudentRecord & {
	lastPerformance: StudentPerformanceEntry | null;
};

const DEFAULT_FILIPINO_STUDENTS: StudentRecord[] = [
	{ id: "fil-001", studentId: "FIL-2025-001", name: "Juan Dela Cruz", grade: "4", section: "A" },
	{ id: "fil-002", studentId: "FIL-2025-002", name: "Maria Santos", grade: "4", section: "B" },
	{ id: "fil-003", studentId: "FIL-2025-003", name: "Josefa Reyes", grade: "5", section: "A" },
	{ id: "fil-004", studentId: "FIL-2025-004", name: "Andres Mercado", grade: "5", section: "B" },
	{ id: "fil-005", studentId: "FIL-2025-005", name: "Luisa Villanueva", grade: "6", section: "C" },
];

const FLASHCARDS = [
	{ sentence: "Ang bata ay naglalaro sa parke.", highlights: ["bata", "parke"] },
	{ sentence: "Kumakain ng masarap na pagkain ang pamilya.", highlights: ["masarap", "pamilya"] },
	{ sentence: "Maganda ang bulaklak sa hardin.", highlights: ["bulaklak", "hardin"] },
	{ sentence: "Mabilis tumakbo ang maliit na aso.", highlights: ["mabilis", "aso"] },
	{ sentence: "Malakas ang ulan kanina.", highlights: ["malakas", "ulan"] },
	{ sentence: "Nagluluto ang nanay ng hapunan.", highlights: ["nanay", "hapunan"] },
	{ sentence: "Mabait ang guro sa eskwelahan.", highlights: ["guro", "eskwelahan"] },
	{ sentence: "Maliwanag ang buwan ngayong gabi.", highlights: ["buwan", "gabi"] },
	{ sentence: "Matulungin ang batang lalaki.", highlights: ["matulungin", "batang"] },
	{ sentence: "Masaya ang mga bata sa party.", highlights: ["masaya", "party"] },
];

export default function MasterTeacherFilipinoFlashcards() {
	const searchParams = useSearchParams();
	const startParam = searchParams?.get("start");
	const startIndex = startParam
		? Math.min(Math.max(Number.parseInt(startParam, 10) || 0, 0), FLASHCARDS.length - 1)
		: 0;

	const [view, setView] = useState<"select" | "session">("select");
	const [students, setStudents] = useState<StudentRecord[]>(DEFAULT_FILIPINO_STUDENTS);
	const [performances, setPerformances] = useState<StudentPerformanceEntry[]>([]);
	const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
	const [studentSearch, setStudentSearch] = useState("");
	const [lastSavedStudentId, setLastSavedStudentId] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(1);

	useEffect(() => {
		if (typeof window === "undefined") return;

		try {
			const storedStudents = window.localStorage.getItem(STUDENT_ROSTER_KEY);
			if (storedStudents) {
				const parsed = JSON.parse(storedStudents) as StudentRecord[];
				if (Array.isArray(parsed)) {
					setStudents(parsed);
				}
			} else {
				window.localStorage.setItem(STUDENT_ROSTER_KEY, JSON.stringify(DEFAULT_FILIPINO_STUDENTS));
			}
		} catch (error) {
			console.warn("Failed to load Filipino remedial roster", error);
		}

		try {
			const storedPerformances = window.localStorage.getItem(PERFORMANCE_HISTORY_KEY);
			if (storedPerformances) {
				const parsed = JSON.parse(storedPerformances) as StudentPerformanceEntry[];
				if (Array.isArray(parsed)) {
					setPerformances(parsed);
				}
			}
		} catch (error) {
			console.warn("Failed to load Filipino remedial performance history", error);
		}
	}, []);

	useEffect(() => {
		if (lastSavedStudentId) {
			const timer = window.setTimeout(() => setLastSavedStudentId(null), 4000);
			return () => window.clearTimeout(timer);
		}
		return undefined;
	}, [lastSavedStudentId]);

	const enrichedStudents = useMemo<EnrichedStudent[]>(() => {
		const latestByStudent = new Map<string, StudentPerformanceEntry>();
		for (const entry of performances) {
			const current = latestByStudent.get(entry.studentId);
			if (!current || current.timestamp < entry.timestamp) {
				latestByStudent.set(entry.studentId, entry);
			}
		}

		return students.map((student) => ({
			...student,
			lastPerformance: latestByStudent.get(student.id) ?? null,
		}));
	}, [students, performances]);

	const filteredStudents = useMemo(() => {
		const term = studentSearch.trim().toLowerCase();
		if (!term) return enrichedStudents;
		return enrichedStudents.filter((student) => {
			const haystack = [student.studentId, student.name, student.section, student.grade]
				.map((value) => value?.toLowerCase?.() ?? "")
				.join(" ");
			return haystack.includes(term);
		});
	}, [enrichedStudents, studentSearch]);

	useEffect(() => {
		setCurrentPage(1);
	}, [studentSearch]);

	const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));

	useEffect(() => {
		setCurrentPage((prev) => Math.min(prev, totalPages));
	}, [totalPages]);

	const paginatedStudents = useMemo(() => {
		const start = (currentPage - 1) * PAGE_SIZE;
		return filteredStudents.slice(start, start + PAGE_SIZE);
	}, [filteredStudents, currentPage]);

	const selectedStudent = useMemo(() => {
		if (!selectedStudentId) return null;
		return enrichedStudents.find((student) => student.id === selectedStudentId) ?? null;
	}, [enrichedStudents, selectedStudentId]);

	const lastSavedStudent = useMemo(() => {
		if (!lastSavedStudentId) return null;
		return enrichedStudents.find((student) => student.id === lastSavedStudentId) ?? null;
	}, [enrichedStudents, lastSavedStudentId]);

	useEffect(() => {
		if (view === "session" && !selectedStudent) {
			setView("select");
		}
	}, [selectedStudent, view]);

	const addPerformanceEntry = useCallback((entry: StudentPerformanceEntry) => {
		setPerformances((prev) => {
			const next = [...prev, entry];
			if (typeof window !== "undefined") {
				window.localStorage.setItem(PERFORMANCE_HISTORY_KEY, JSON.stringify(next));
			}
			return next;
		});
	}, []);

	const [current, setCurrent] = useState(startIndex);
	const currentCard = FLASHCARDS[current] ?? FLASHCARDS[0];
	const sentence = currentCard?.sentence ?? "";

	const [isListening, setIsListening] = useState(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const [recognizedText, setRecognizedText] = useState("");
	const [feedback, setFeedback] = useState("");
	const [metrics, setMetrics] = useState<ReturnType<typeof computeScores> | null>(null);

	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const mediaStreamRef = useRef<MediaStream | null>(null);
	const silenceStartRef = useRef<number | null>(null);
	const lastVoiceTimestampRef = useRef<number | null>(null);
	const speechStartRef = useRef<number | null>(null);
	const speechEndRef = useRef<number | null>(null);
	const cumulativeSilentMsRef = useRef<number>(0);

	const startAudioAnalyser = async (stream: MediaStream) => {
		audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
		const ctx = audioContextRef.current!;
		const src = ctx.createMediaStreamSource(stream);
		const analyser = ctx.createAnalyser();
		analyser.fftSize = 2048;
		src.connect(analyser);
		analyserRef.current = analyser;

		const data = new Float32Array(analyser.fftSize);
		let rafId: number;
		const check = () => {
			analyser.getFloatTimeDomainData(data);
			let sum = 0;
			for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
			const rms = Math.sqrt(sum / data.length);
			const db = 20 * Math.log10(rms + 1e-12);
			const now = performance.now();

			const VOICE_DB_THRESHOLD = -50;
			if (db > VOICE_DB_THRESHOLD) {
				lastVoiceTimestampRef.current = now;
				if (!speechStartRef.current) speechStartRef.current = now;
				silenceStartRef.current = null;
			} else {
				if (!silenceStartRef.current) {
					silenceStartRef.current = now;
				} else {
					const silenceDuration = now - (silenceStartRef.current || now);
					if (silenceDuration > 200 && lastVoiceTimestampRef.current) {
						cumulativeSilentMsRef.current += silenceDuration;
						lastVoiceTimestampRef.current = null;
					}
				}
			}
			rafId = requestAnimationFrame(check);
		};
		rafId = requestAnimationFrame(check);
		return () => cancelAnimationFrame(rafId);
	};

	const stopAudioAnalyser = useCallback(() => {
		try {
			if (audioContextRef.current) {
				audioContextRef.current.close();
				audioContextRef.current = null;
			}
			if (mediaStreamRef.current) {
				mediaStreamRef.current.getTracks().forEach((track) => track.stop());
				mediaStreamRef.current = null;
			}
		} catch {
			/* no-op */
		}
	}, []);

	const resetSessionTracking = useCallback(() => {
		setRecognizedText("");
		setFeedback("");
		setMetrics(null);
		cumulativeSilentMsRef.current = 0;
		speechStartRef.current = null;
		speechEndRef.current = null;
		stopAudioAnalyser();
		setIsListening(false);
		setIsPlaying(false);
	}, [stopAudioAnalyser]);

	useEffect(() => () => stopAudioAnalyser(), [stopAudioAnalyser]);
	useEffect(() => {
		resetSessionTracking();
	}, [current, resetSessionTracking]);

	const handlePrev = () => setCurrent((prev) => Math.max(prev - 1, 0));
	const handleNext = () => setCurrent((prev) => Math.min(prev + 1, FLASHCARDS.length - 1));

	const handleStartSession = (studentId: string) => {
		setSelectedStudentId(studentId);
		setCurrent(startIndex);
		resetSessionTracking();
		setView("session");
	};

	const handleStopSession = () => {
		const activeSentence = FLASHCARDS[current]?.sentence ?? "";
		if (selectedStudentId && metrics) {
			addPerformanceEntry({
				id: `perf-${Date.now()}`,
				studentId: selectedStudentId,
				timestamp: new Date().toISOString(),
				pronScore: metrics.pronScore,
				fluencyScore: metrics.fluencyScore,
				phonemeAccuracy: metrics.phonemeAccuracy,
				wpm: metrics.wpm,
				cardIndex: current,
				sentence: activeSentence,
			});
			setLastSavedStudentId(selectedStudentId);
		}

		if (typeof window !== "undefined" && "speechSynthesis" in window) {
			window.speechSynthesis.cancel();
		}

		resetSessionTracking();
		setCurrent(startIndex);
		setSelectedStudentId(null);
		setView("select");
	};

	const handleSpeak = () => {
		if (typeof window !== "undefined" && "speechSynthesis" in window) {
			const utterance = new window.SpeechSynthesisUtterance(sentence);
			utterance.rate = 0.9;
			utterance.pitch = 1.1;
			utterance.lang = "fil-PH";

			setIsPlaying(true);
			utterance.onend = () => setIsPlaying(false);
			utterance.onerror = () => setIsPlaying(false);

			window.speechSynthesis.speak(utterance);
		}
	};

	function computeScores(expectedText: string, spokenText: string, resultConfidence: number | null) {
		const expected = normalizeText(expectedText);
		const spoken = normalizeText(spokenText || "");

		const expWords = expected.split(/\s+/).filter(Boolean);
		const spkWords = spoken.split(/\s+/).filter(Boolean);

		let exactMatches = 0;
		let softMatches = 0;
		const perWordDetails: Array<{ expected: string; matched: string; similarity: number }> = [];

		for (let i = 0; i < expWords.length; i++) {
			const expectedWord = expWords[i];
			let best = "";
			let bestScore = Infinity;
			for (let j = Math.max(0, i - 2); j < Math.min(spkWords.length, i + 3); j++) {
				const dist = levenshtein(expectedWord, spkWords[j]);
				if (dist < bestScore) {
					bestScore = dist;
					best = spkWords[j];
				}
			}
			const lev = levenshtein(expectedWord, best || "");
			const similarity = (Math.max(0, expectedWord.length - lev) / Math.max(1, expectedWord.length)) * 100;
			if (similarity >= 95) exactMatches++;
			else if (similarity >= 60) softMatches++;
			perWordDetails.push({ expected: expectedWord, matched: best || "", similarity: Math.round(similarity) });
		}

		const wordAccuracy = ((exactMatches + 0.6 * softMatches) / Math.max(1, expWords.length)) * 100;
		const expPhArr = expWords.flatMap((word) => approxPhonemes(word));
		const spkPhArr = spkWords.flatMap((word) => approxPhonemes(word));
		const phonemeAccuracy = comparePhonemeArrays(expPhArr, spkPhArr);

		const totalSpeechMs = speechEndRef.current && speechStartRef.current
			? Math.max(1, speechEndRef.current - speechStartRef.current)
			: 1;
		const totalSilenceMs = cumulativeSilentMsRef.current;
		const pauseRatio = Math.min(1, totalSilenceMs / totalSpeechMs);
		const fluencyScore = Math.round((1 - pauseRatio) * 100);
		const wpm = Math.round((expWords.length / (totalSpeechMs / 1000)) * 60);
		const conf = resultConfidence ?? 0.8;
		const pronScore = Math.round(0.5 * wordAccuracy + 0.35 * phonemeAccuracy + 0.15 * conf * 100);

		let remarks = "";
		if (pronScore > 85 && fluencyScore > 80) remarks = "Magaling! Napakagaling ng iyong pagbigkas at fluency! 🌟";
		else if (pronScore > 70) remarks = "Magaling — kaunting pagsasanay pa sa pagbigkas at fluency. 💪";
		else if (pronScore > 50) remarks = "Katamtaman — kailangan ng pagsasanay sa mga tunog at bawasan ang paghinto. 🗣️";
		else remarks = "Kailangan ng mas maraming pagsasanay — pagbutihin ang kalinisan at bilis. 📚";

		return {
			expWords,
			spkWords,
			perWordDetails,
			wordAccuracy: Math.round(wordAccuracy * 100) / 100,
			phonemeAccuracy: Math.round(phonemeAccuracy * 100) / 100,
			fluencyScore,
			wpm,
			pronScore,
			remarks,
		};
	}

	const handleMicrophone = async () => {
		const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
		if (!SpeechRecognition) {
			alert("Hindi suportado ang speech recognition sa iyong browser.");
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			mediaStreamRef.current = stream;
			await startAudioAnalyser(stream);

			const recognition = new SpeechRecognition();
			recognition.lang = "fil-PH";
			recognition.interimResults = false;
			recognition.maxAlternatives = 1;

			cumulativeSilentMsRef.current = 0;
			speechStartRef.current = null;
			speechEndRef.current = null;
			lastVoiceTimestampRef.current = null;
			silenceStartRef.current = null;

			setIsListening(true);
			setRecognizedText("");
			setFeedback("Nakikinig... 🎧");

			recognition.onstart = () => {
				speechStartRef.current = performance.now();
			};

			recognition.onresult = (event: any) => {
				const spoken = event.results[0][0].transcript;
				const conf = event.results[0][0].confidence ?? null;
				setRecognizedText(spoken);
				speechEndRef.current = performance.now();

				const score = computeScores(sentence, spoken, conf);
				setMetrics(score);
				setFeedback(score.remarks);

				stopAudioAnalyser();
				setIsListening(false);
			};

			recognition.onerror = () => {
				setFeedback("May error sa pagkilala ng pagsasalita. Pakisubukan muli.");
				stopAudioAnalyser();
				setIsListening(false);
			};

			recognition.onend = () => {
				if (!speechEndRef.current) speechEndRef.current = performance.now();
				if (!recognizedText) {
					setFeedback("Walang narinig na pagsasalita. Pakisubukan muli.");
					stopAudioAnalyser();
					setIsListening(false);
				}
			};

			recognition.start();

			setTimeout(() => {
				try {
					recognition.stop();
				} catch {
					/* no-op */
				}
			}, 45000);
		} catch (error) {
			console.error(error);
			setFeedback("Error sa mikropono o hindi naibigay ang permiso.");
			setIsListening(false);
			stopAudioAnalyser();
		}
	};

	const selectionRows = paginatedStudents.map((student, index) => ({
		...student,
		no: (currentPage - 1) * PAGE_SIZE + index + 1,
		lastPhonemic: student.lastPerformance ? `${Math.round(student.lastPerformance.phonemeAccuracy)}%` : "—",
	}));

	const selectionTable = (
		<div className="flex flex-col gap-4 h-full">
			<TableList
				columns={[
					{ key: "no", title: "No#" },
					{ key: "studentId", title: "Student ID" },
					{ key: "name", title: "Full Name" },
					{ key: "grade", title: "Grade" },
					{ key: "section", title: "Section" },
					{ key: "lastPhonemic", title: "Phonemic" },
				]}
				data={selectionRows}
				actions={(row: any) => (
					<UtilityButton small onClick={() => handleStartSession(row.id)}>
						Start Remedial
					</UtilityButton>
				)}
				pageSize={PAGE_SIZE}
			/>

			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<p className="text-xs text-gray-500">
					Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredStudents.length)} of {filteredStudents.length}
				</p>
				<div className="flex items-center gap-2">
					<button
						type="button"
						className="rounded-full border border-[#013300] px-4 py-2 text-sm text-[#013300] transition hover:bg-emerald-50 disabled:opacity-40"
						onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
						disabled={currentPage <= 1}
					>
						Previous
					</button>
					<span className="text-sm text-gray-600">{currentPage} / {totalPages}</span>
					<button
						type="button"
						className="rounded-full border border-[#013300] px-4 py-2 text-sm text-[#013300] transition hover:bg-emerald-50 disabled:opacity-40"
						onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
						disabled={currentPage >= totalPages}
					>
						Next
					</button>
				</div>
			</div>
		</div>
	);

	const selectionProps = {
		summaryText: `${filteredStudents.length} student(s) listed • Page ${currentPage} of ${totalPages}`,
		searchValue: studentSearch,
		onSearchChange: (value: string) => setStudentSearch(value),
		table: selectionTable,
		lastSavedMessage: lastSavedStudent
			? `Nai-save na ang pinakahuling performance ni ${lastSavedStudent.name}.`
			: undefined,
	};

	if (view === "session" && !selectedStudent) {
		return null;
	}

	const insightMetrics = [
		{ label: "Pronunciation", value: metrics ? `${metrics.pronScore}%` : "—" },
		{ label: "Fluency", value: metrics ? `${metrics.fluencyScore}%` : "—" },
		{ label: "Sound Accuracy", value: metrics ? `${metrics.phonemeAccuracy?.toFixed(0)}%` : "—" },
		{ label: "Reading Speed", value: metrics ? `${metrics.wpm} WPM` : "—" },
	];

	const sessionProps = selectedStudent
		? {
				student: {
					studentId: selectedStudent.studentId,
					name: selectedStudent.name,
					grade: selectedStudent.grade,
					section: selectedStudent.section,
				},
				levelLabel: "Non-Reader Level",
				cardText: sentence,
				cardActions: [
					{
						id: "speak",
						label: "Play Sentence",
						activeLabel: "Playing...",
						icon: <Volume2Icon />,
						onClick: handleSpeak,
						isActive: isPlaying,
					},
					{
						id: "mic",
						label: "Pronunciation Check",
						activeLabel: "Listening..",
						icon: <MicIcon />,
						onClick: handleMicrophone,
						isActive: isListening,
					},
				],
				insights: {
					heading: "Real-time insights",
					highlightLabel: "Transcription",
					highlightText: recognizedText || "Waiting for microphone recording.",
					metrics: insightMetrics,
					footerLabel: "Remarks",
					footerText: feedback || "Patuloy na magsalita upang makakuha ng feedback.",
				},
				progress: { currentIndex: current, totalCount: FLASHCARDS.length },
				nav: {
					onPrev: handlePrev,
					onNext: handleNext,
					onStop: handleStopSession,
					disablePrev: current === 0,
					disableNext: current === FLASHCARDS.length - 1,
					prevLabel: "Previous",
					nextLabel: "Next",
					stopLabel: "Save & Exit",
				},
			}
		: undefined;

	return (
		<FlashcardsTemplate
			view={view}
			subjectLabel="Filipino"
			cardLabel="Card"
			selection={selectionProps}
			session={sessionProps}
		/>
	);
}

