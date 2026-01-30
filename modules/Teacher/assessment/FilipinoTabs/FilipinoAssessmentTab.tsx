"use client";
import { useEffect, useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";
import KebabMenu from "@/components/Common/Menus/KebabMenu";
import AddQuizModal, { type QuizData, type Student as QuizStudent, type Question as ModalQuestion, type Section as ModalSection } from "../Modals/AddQuizModal";
import ViewResponsesModal from "../Modals/ViewResponsesModal";
import DeleteConfirmationModal from "../Modals/DeleteConfirmationModal";
import UpdateConfirmationModal from "../Modals/UpdateConfirmationModal";
import QrCodeModal from "../Modals/QrCodeModal";
import { cloneResponses, type QuizResponse } from "../types";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import { createAssessment, fetchAssessments, mapQuizQuestionsToPayload, updateAssessment } from "@/lib/assessments/client";

export const FILIPINO_ASSESSMENT_LEVELS = [
  "Non Reader",
  "Syllable",
  "Word",
  "Phrase",
  "Sentence",
  "Paragraph",
] as const;

const FILIPINO_LEVEL_ALIASES: Record<string, FilipinoAssessmentLevel> = {
  "Di Marunong Bumasa": "Non Reader",
  Pantig: "Syllable",
  Salita: "Word",
  Parirala: "Phrase",
  Pangungusap: "Sentence",
  Talata: "Paragraph",
};

export type FilipinoAssessmentLevel = (typeof FILIPINO_ASSESSMENT_LEVELS)[number];

export interface FilipinoQuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'matching';
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  points: number;
  testNumber?: string;
  sectionId?: string;
  sectionTitle?: string;
}

export interface FilipinoQuizSection {
  id: string;
  title: string;
  description?: string;
}

export interface FilipinoQuiz {
  id: number;
  title: string;
  phonemicLevel: FilipinoAssessmentLevel;
  schedule: string;
  duration: number; // in minutes
  questions: FilipinoQuizQuestion[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  students?: QuizStudent[];
  sections?: FilipinoQuizSection[];
  responses?: QuizResponse[];
  subjectId?: number | null;
  phonemicId?: number | null;
  quizCode?: string | null;
  qrToken?: string | null;
  submittedCount?: number;
}

const INITIAL_FILIPINO_QUIZZES: Record<FilipinoAssessmentLevel, FilipinoQuiz[]> = {
  "Non Reader": [],
  Syllable: [],
  Word: [],
  Phrase: [],
  Sentence: [],
  Paragraph: [],
};

const STORAGE_KEY = "MASTER_TEACHER_ASSESSMENT_FILIPINO";

type FilipinoQuizzesByLevel = Record<FilipinoAssessmentLevel, FilipinoQuiz[]>;

const generateSectionId = () => `section-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;

const KNOWN_FILIPINO_LEVELS = new Set<FilipinoAssessmentLevel>(FILIPINO_ASSESSMENT_LEVELS);

const createEmptyFilipinoQuizzes = (): FilipinoQuizzesByLevel =>
  FILIPINO_ASSESSMENT_LEVELS.reduce((acc, level) => {
    acc[level] = [];
    return acc;
  }, {} as FilipinoQuizzesByLevel);

const normalizeFilipinoQuizzesRecord = (raw: Record<string, FilipinoQuiz[]>): FilipinoQuizzesByLevel => {
  const normalized = createEmptyFilipinoQuizzes();

  Object.entries(raw).forEach(([key, quizzes]) => {
    const targetLevel = KNOWN_FILIPINO_LEVELS.has(key as FilipinoAssessmentLevel)
      ? (key as FilipinoAssessmentLevel)
      : FILIPINO_LEVEL_ALIASES[key];

    if (!targetLevel) {
      return;
    }

    normalized[targetLevel] = quizzes.map((quiz) => ({
      ...quiz,
      phonemicLevel: targetLevel,
      questions: quiz.questions.map((question) => ({
        ...question,
        options: Array.isArray(question.options) ? [...question.options] : undefined,
      })),
      sections: quiz.sections?.map((section) => ({ ...section })),
      students: (quiz.students ?? []).map((student) => ({ ...student })),
      responses: cloneResponses(quiz.responses),
    }));
  });

  return normalized;
};

function cloneInitialFilipinoQuizzes(): FilipinoQuizzesByLevel {
  return FILIPINO_ASSESSMENT_LEVELS.reduce((acc, level) => {
    acc[level] = INITIAL_FILIPINO_QUIZZES[level].map((item) => ({
      ...item,
      questions: item.questions.map((question) => ({
        ...question,
        options: Array.isArray(question.options) ? [...question.options] : undefined,
      })),
      sections: item.sections?.map((section) => ({ ...section })),
      students: (item.students ?? []).map((student) => ({ ...student })),
      responses: cloneResponses(item.responses),
    }));
    return acc;
  }, {} as FilipinoQuizzesByLevel);
}

function readStoredFilipinoQuizzes(): FilipinoQuizzesByLevel | null {
  if (typeof window === "undefined") return null;

  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  if (!storedValue) return null;

  try {
    const parsed = JSON.parse(storedValue) as Record<string, FilipinoQuiz[]>;
    return normalizeFilipinoQuizzesRecord(parsed);
  } catch {
    return null;
  }
}

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
};

const calculateDurationMinutes = (start?: string, end?: string, fallback = 30) => {
  const startValue = start ? Date.parse(start) : Number.NaN;
  const endValue = end ? Date.parse(end) : Number.NaN;
  if (!Number.isFinite(startValue) || !Number.isFinite(endValue) || endValue <= startValue) {
    return fallback;
  }
  return Math.max(1, Math.round((endValue - startValue) / 60000));
};

const mapApiQuestionType = (value: string) => {
  if (value === "multiple_choice") return "multiple-choice" as const;
  if (value === "true_false") return "true-false" as const;
  return "short-answer" as const;
};

const buildDefaultSection = (): FilipinoQuizSection => ({
  id: generateSectionId(),
  title: "Section 1",
  description: "",
});

const mapAssessmentToQuiz = (assessment: any): FilipinoQuiz => {
  const startDate = assessment.startDate ?? assessment.start_time ?? assessment.startTime ?? "";
  const endDate = assessment.endDate ?? assessment.end_time ?? assessment.endTime ?? "";
  const duration = calculateDurationMinutes(startDate, endDate, 30);
  const section = buildDefaultSection();
  const questions: FilipinoQuizQuestion[] = (assessment.questions ?? []).map((question: any, index: number) => ({
    id: String(question.id ?? index + 1),
    type: mapApiQuestionType(question.type ?? question.question_type ?? "short_answer"),
    question: question.question ?? question.questionText ?? "",
    options: Array.isArray(question.options) ? [...question.options] : question.choices?.map((choice: any) => choice.text) ?? undefined,
    correctAnswer: question.correctAnswer ?? "",
    points: Number(question.points ?? 1),
    sectionId: section.id,
    sectionTitle: section.title,
  }));

  return {
    id: Number(assessment.id ?? assessment.assessment_id ?? Date.now()),
    title: assessment.title ?? "",
    phonemicLevel: (assessment.phonemicLevel ?? assessment.phonemic_level_name ?? "Non Reader") as FilipinoAssessmentLevel,
    schedule: startDate,
    duration,
    questions,
    isPublished: Boolean(assessment.isPublished ?? assessment.is_published),
    createdAt: assessment.createdAt ?? assessment.created_at ?? new Date().toISOString(),
    updatedAt: assessment.updatedAt ?? assessment.updated_at ?? new Date().toISOString(),
    description: assessment.description ?? "",
    startDate,
    endDate,
    sections: [section],
    students: [],
    responses: [],
    subjectId: assessment.subjectId ?? assessment.subject_id ?? null,
    phonemicId: assessment.phonemicId ?? assessment.phonemic_id ?? null,
    quizCode: assessment.quizCode ?? assessment.quiz_code ?? null,
    qrToken: assessment.qrToken ?? assessment.qr_token ?? null,
    submittedCount: Number(assessment.submittedCount ?? assessment.submitted_count ?? 0),
  };
};

const groupAssessmentsByLevel = (assessments: any[]): FilipinoQuizzesByLevel => {
  const grouped = createEmptyFilipinoQuizzes();

  assessments.forEach((assessment) => {
    const level = assessment.phonemicLevel ?? assessment.phonemic_level_name;
    if (KNOWN_FILIPINO_LEVELS.has(level as FilipinoAssessmentLevel)) {
      grouped[level as FilipinoAssessmentLevel].push(mapAssessmentToQuiz(assessment));
    }
  });

  return grouped;
};

type QuizScheduleStatus = "Pending" | "Active" | "Completed";

const QUIZ_STATUS_STYLES: Record<QuizScheduleStatus, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Active: "bg-emerald-100 text-emerald-800",
  Completed: "bg-slate-200 text-slate-700",
};

const getQuizScheduleStatus = (quiz: FilipinoQuiz): QuizScheduleStatus => {
  const now = Date.now();
  const startRaw = quiz.startDate ?? quiz.schedule;
  const endRaw = quiz.endDate ?? quiz.schedule;

  const startTime = startRaw ? Date.parse(startRaw) : Number.NaN;
  const rawEndTime = endRaw ? Date.parse(endRaw) : Number.NaN;
  const derivedEndTime = Number.isFinite(rawEndTime)
    ? rawEndTime
    : Number.isFinite(startTime)
      ? startTime + Math.max(quiz.duration ?? 0, 0) * 60000
      : Number.NaN;

  if (!Number.isFinite(startTime)) {
    return "Pending";
  }

  if (now < startTime) {
    return "Pending";
  }

  if (Number.isFinite(derivedEndTime) && now > derivedEndTime) {
    return "Completed";
  }

  return "Active";
};

const toQuizQuestion = (
  question: ModalQuestion,
  sectionLookup: Map<string, ModalSection>
): FilipinoQuizQuestion => {
  const section = sectionLookup.get(question.sectionId);
  const sectionTitle = section?.title ?? question.sectionTitle ?? "";

  const base: FilipinoQuizQuestion = {
    id: question.id,
    type: question.type,
    question: question.question,
    correctAnswer: question.correctAnswer,
    points: question.points,
    sectionId: section?.id ?? question.sectionId,
    sectionTitle,
    testNumber: sectionTitle || question.sectionTitle,
  };

  if (question.type === "multiple-choice") {
    base.options = Array.isArray(question.options) && question.options.length > 0
      ? [...question.options]
      : ["", "", "", ""];
  } else if (question.type === "true-false") {
    base.options = Array.isArray(question.options) && question.options.length > 0
      ? [...question.options]
      : ["Tama", "Mali"];
  }

  return base;
};

const toModalQuestion = (
  question: FilipinoQuizQuestion,
  index: number,
  sectionId: string,
  sectionTitle: string
): ModalQuestion => {
  const coercedType: ModalQuestion["type"] =
    question.type === "matching"
      ? "multiple-choice"
      : (question.type as ModalQuestion["type"]);

  const base: ModalQuestion = {
    id: question.id,
    sectionId,
    sectionTitle,
    type: coercedType,
    question: question.question,
    correctAnswer: Array.isArray(question.correctAnswer)
      ? (question.correctAnswer[0] ?? "")
      : question.correctAnswer,
    points: question.points,
  };

  if (coercedType === "multiple-choice") {
    base.options = Array.isArray(question.options) && question.options.length > 0
      ? [...question.options]
      : ["", "", "", ""];
  } else if (coercedType === "true-false") {
    base.options = Array.isArray(question.options) && question.options.length > 0
      ? [...question.options]
      : ["Tama", "Mali"];
  }

  return base;
};

const mapQuizDataToQuiz = (
  data: QuizData,
  level: FilipinoAssessmentLevel,
  existing?: FilipinoQuiz
): FilipinoQuiz => {
  const now = new Date().toISOString();
  const duration = calculateDurationMinutes(data.startDate, data.endDate, existing?.duration ?? 30);
  const sectionLookup = new Map<string, ModalSection>();
  data.sections.forEach((section) => {
    sectionLookup.set(section.id, section);
  });

  return {
    id: existing?.id ?? Date.now(),
    title: data.title.trim(),
    phonemicLevel: level,
    schedule: data.startDate,
    duration,
    questions: data.questions.map((question) => toQuizQuestion(question, sectionLookup)),
    isPublished: existing?.isPublished ?? data.isPublished,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    description: data.description,
    startDate: data.startDate,
    endDate: data.endDate,
    students: data.students.map((student) => ({ ...student })),
    sections: data.sections.map((section) => ({ ...section })),
    responses: cloneResponses(existing?.responses),
  };
};

const mapQuizToModalData = (quiz: FilipinoQuiz): QuizData => {
  const normalizedSections: ModalSection[] = (quiz.sections ?? []).map((section, index) => ({
    id: section.id || generateSectionId(),
    title: section.title?.trim() || `Section ${index + 1}`,
    description: section.description ?? "",
  }));

  const sectionLookup = new Map<string, ModalSection>();
  normalizedSections.forEach((section) => {
    sectionLookup.set(section.id, section);
  });

  const ensureSection = (title: string) => {
    const normalizedTitle = (title ?? "").trim() || `Section ${sectionLookup.size + 1}`;
    for (const existing of sectionLookup.values()) {
      if (existing.title === normalizedTitle) {
        return existing.id;
      }
    }

    const newSection: ModalSection = {
      id: generateSectionId(),
      title: normalizedTitle,
      description: "",
    };

    normalizedSections.push(newSection);
    sectionLookup.set(newSection.id, newSection);
    return newSection.id;
  };

  const questions = quiz.questions.map((question, index) => {
    const fallbackTitle = question.sectionTitle ?? question.testNumber ?? `Section ${index + 1}`;
    const resolvedSectionId =
      question.sectionId && sectionLookup.has(question.sectionId)
        ? question.sectionId
        : ensureSection(fallbackTitle);
    const resolvedSectionTitle = sectionLookup.get(resolvedSectionId)?.title ?? fallbackTitle;

    return toModalQuestion(question, index, resolvedSectionId, resolvedSectionTitle);
  });

  if (normalizedSections.length === 0) {
    const defaultSection: ModalSection = {
      id: generateSectionId(),
      title: "Section 1",
      description: "",
    };
    normalizedSections.push(defaultSection);
    sectionLookup.set(defaultSection.id, defaultSection);
  }

  return {
    title: quiz.title,
    description: quiz.description ?? "",
    startDate: quiz.startDate ?? quiz.schedule,
    endDate: quiz.endDate ?? quiz.schedule,
    phonemicLevel: quiz.phonemicLevel,
    students: (quiz.students ?? []).map((student) => ({ ...student })),
    questions,
    sections: normalizedSections,
    isPublished: quiz.isPublished,
  };
};

interface FilipinoAssessmentTabProps {
  level: FilipinoAssessmentLevel;
}

export default function FilipinoAssessmentTab({ level }: FilipinoAssessmentTabProps) {
  const [quizzesByLevel, setQuizzesByLevel] = useState<FilipinoQuizzesByLevel>(() => cloneInitialFilipinoQuizzes());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<FilipinoQuiz | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedQuizzes, setSelectedQuizzes] = useState<Set<number>>(new Set());
  const [isResponsesOpen, setIsResponsesOpen] = useState(false);
  const [responsesQuiz, setResponsesQuiz] = useState<FilipinoQuiz | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);
  const [pendingUpdateData, setPendingUpdateData] = useState<QuizData | null>(null);

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrQuiz, setQrQuiz] = useState<FilipinoQuiz | null>(null);

  const quizzes = quizzesByLevel[level] ?? [];

  const reloadAssessments = async () => {
    const profile = getStoredUserProfile();
    const userId = profile?.userId;
    if (!userId) return;
    const assessments = await fetchAssessments({
      creatorId: String(userId),
      creatorRole: "teacher",
    });
    const grouped = groupAssessmentsByLevel(assessments);
    setQuizzesByLevel(grouped);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadAssessments() {
      try {
        await reloadAssessments();
      } catch (error) {
        if (cancelled) return;
        console.error(error);
      }
    }

    loadAssessments();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveQuizzes = (newQuizzes: FilipinoQuizzesByLevel) => {
    setQuizzesByLevel(newQuizzes);
  };

  const handleCreateQuiz = () => {
    setEditingQuiz(null);
    setIsModalOpen(true);
  };

  const handleEditQuiz = (quiz: FilipinoQuiz) => {
    if ((quiz.submittedCount ?? 0) > 0) {
      alert("This quiz already has submitted attempts and can no longer be edited.");
      return;
    }
    setEditingQuiz(quiz);
    setIsModalOpen(true);
  };

  const handleViewResponses = (quiz: FilipinoQuiz) => {
    setResponsesQuiz(quiz);
    setIsResponsesOpen(true);
  };

  const closeResponsesModal = () => {
    setIsResponsesOpen(false);
    setResponsesQuiz(null);
  };

  const handleShowQr = (quiz: FilipinoQuiz) => {
    setQrQuiz(quiz);
    setIsQrModalOpen(true);
  };

  const handleDeleteSelected = () => {
    if (selectedQuizzes.size === 0) return;
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    const updatedQuizzes = {
      ...quizzesByLevel,
      [level]: quizzesByLevel[level].filter(quiz => !selectedQuizzes.has(quiz.id))
    };
    saveQuizzes(updatedQuizzes);
    setSelectedQuizzes(new Set());
    setSelectMode(false);
    setShowDeleteModal(false);
  };

  const handleSaveQuiz = (quizData: QuizData) => {
    if (editingQuiz) {
      setPendingUpdateData(quizData);
      setIsUpdateConfirmOpen(true);
      return;
    }

    (async () => {
      try {
        const profile = getStoredUserProfile();
        const userId = profile?.userId;
        if (!userId) {
          alert("Missing user information. Please log in again.");
          return;
        }

        await createAssessment({
          title: quizData.title.trim(),
          description: quizData.description ?? "",
          subjectName: "Filipino",
          phonemicLevel: level,
          startTime: quizData.startDate,
          endTime: quizData.endDate,
          isPublished: quizData.isPublished,
          createdBy: String(userId),
          creatorRole: "teacher",
          questions: mapQuizQuestionsToPayload(quizData.questions),
        });

        await reloadAssessments();
        setIsModalOpen(false);
        setEditingQuiz(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save quiz.";
        alert(message);
      }
    })();
  };

  const confirmUpdateQuiz = () => {
    if (!editingQuiz || !pendingUpdateData) {
      setIsUpdateConfirmOpen(false);
      setPendingUpdateData(null);
      return;
    }

    (async () => {
      try {
        await updateAssessment(editingQuiz.id, {
          title: pendingUpdateData.title.trim(),
          description: pendingUpdateData.description ?? "",
          subjectId: editingQuiz.subjectId ?? null,
          subjectName: "Filipino",
          gradeId: null,
          phonemicId: editingQuiz.phonemicId ?? null,
          phonemicLevel: level,
          startTime: pendingUpdateData.startDate,
          endTime: pendingUpdateData.endDate,
          isPublished: pendingUpdateData.isPublished,
          questions: mapQuizQuestionsToPayload(pendingUpdateData.questions),
        });

        await reloadAssessments();
        setIsUpdateConfirmOpen(false);
        setPendingUpdateData(null);
        setIsModalOpen(false);
        setEditingQuiz(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update quiz.";
        alert(message);
      }
    })();
  };

  const cancelUpdateQuiz = () => {
    setIsUpdateConfirmOpen(false);
    setPendingUpdateData(null);
  };

  type TableRow = FilipinoQuiz & { no: number };
  const rows: TableRow[] = quizzes.map((quiz, index) => ({
    ...quiz,
    no: index + 1,
  }));

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 md:mb-2 gap-4">
        <p className="text-gray-600 text-md font-medium">Total Quizzes: {quizzes.length}</p>
        <div className="flex gap-2">
          {selectMode ? (
            <>
              <SecondaryButton small onClick={() => { setSelectMode(false); setSelectedQuizzes(new Set()); }}>
                Cancel
              </SecondaryButton>
              {selectedQuizzes.size > 0 && (
                <DangerButton small onClick={handleDeleteSelected}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1">
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete ({selectedQuizzes.size})
                </DangerButton>
              )}
            </>
          ) : (
            <KebabMenu
              small
              align="right"
              renderItems={(close) => (
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleCreateQuiz();
                      close();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Create Quiz
                  </button>
                  <button
                    onClick={() => {
                      setSelectMode(true);
                      close();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                    Select
                  </button>
                </div>
              )}
            />
          )}
        </div>
      </div>

      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "title", title: "Title" },
          {
            key: "quizCode",
            title: "Code",
            render: (row: TableRow) => (
              <span className="font-mono font-bold text-gray-700 tracking-wider">
                {row.quizCode || "-"}
              </span>
            )
          },
          { key: "phonemicLevel", title: "Phonemic" },
          {
            key: "startDate",
            title: "Start",
            render: (row: TableRow) => formatDateTime(row.startDate ?? row.schedule),
          },
          {
            key: "endDate",
            title: "End",
            render: (row: TableRow) => formatDateTime(row.endDate ?? row.schedule),
          },
          {
            key: "responses",
            title: "Responses",
            render: (row: TableRow) => row.responses?.length ?? 0,
          },
          {
            key: "status",
            title: "Status",
            render: (row: TableRow) => {
              const status = getQuizScheduleStatus(row);
              const badgeClass = QUIZ_STATUS_STYLES[status];
              return (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${badgeClass}`}>
                  {status}
                </span>
              );
            },
          },
        ]}
        data={rows}
        actions={(row: TableRow) => (
          <div className="flex gap-2">
            <UtilityButton small onClick={() => handleEditQuiz(row)}>
              Edit
            </UtilityButton>
            <UtilityButton small onClick={() => handleViewResponses(row)}>
              Responses ({row.responses?.length ?? 0})
            </UtilityButton>
            {row.isPublished && row.quizCode && (
              <button
                onClick={() => handleShowQr(row)}
                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                title="Show QR Code"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4h2v-4zM6 16H4m12 0v1m0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h4v4H4V4zm12 0h4v4h-4V4zM4 16h4v4H4v-4z M9 9h6 M15 15h.01" />
                  {/* Fallback rough icon */}
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v18H3z M7 7h3v3H7z M14 7h3v3h-3z M7 14h3v3H7z M14 14h3v3h-3z" />
                </svg>
              </button>
            )}
          </div>
        )}
        selectable={selectMode}
        selectedItems={selectedQuizzes}
        onSelectAll={(checked) => {
          if (checked) {
            setSelectedQuizzes(new Set(rows.map(r => r.id)));
          } else {
            setSelectedQuizzes(new Set());
          }
        }}
        onSelectItem={(id, checked) => {
          const newSelected = new Set(selectedQuizzes);
          if (checked) {
            newSelected.add(id);
          } else {
            newSelected.delete(id);
          }
          setSelectedQuizzes(newSelected);
        }}
        pageSize={10}
      />

      {/* Quiz Creation/Editing Modal */}
      <AddQuizModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingQuiz(null);
          setPendingUpdateData(null);
          setIsUpdateConfirmOpen(false);
        }}
        onSave={handleSaveQuiz}
        initialData={editingQuiz ? mapQuizToModalData(editingQuiz) : undefined}
        level={level}
        subject="Filipino"
      />

      {qrQuiz && qrQuiz.quizCode && (
        <QrCodeModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          quizTitle={qrQuiz.title}
          quizCode={qrQuiz.quizCode}
        />
      )}

      {responsesQuiz && (
        <ViewResponsesModal
          isOpen={isResponsesOpen}
          onClose={closeResponsesModal}
          quizTitle={responsesQuiz.title}
          responses={responsesQuiz.responses ?? []}
          questions={responsesQuiz.questions.map((question) => ({
            id: question.id,
            prompt: question.question,
            sectionTitle: question.sectionTitle,
            type: question.type,
            options: question.options,
            correctAnswer: question.correctAnswer,
          }))}
          totalStudents={responsesQuiz.students?.length ?? 0}
        />
      )}

      <UpdateConfirmationModal
        show={isUpdateConfirmOpen}
        onClose={cancelUpdateQuiz}
        onConfirm={confirmUpdateQuiz}
        title="Confirm Quiz Update"
        details={editingQuiz ? `Save changes to "${editingQuiz.title}"?` : undefined}
        confirmLabel="Save changes"
      />

      <DeleteConfirmationModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        entityLabel={selectedQuizzes.size === 1 ? "quiz" : "quizzes"}
        description={`Are you sure you want to delete ${selectedQuizzes.size} selected quiz${selectedQuizzes.size === 1 ? '' : 'zes'}? This action cannot be undone.`}
      />
    </div>
  );
}