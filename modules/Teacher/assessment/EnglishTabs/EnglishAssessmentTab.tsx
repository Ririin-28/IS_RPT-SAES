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

export const ENGLISH_ASSESSMENT_LEVELS = [
  "Non Reader",
  "Syllable",
  "Word",
  "Phrase",
  "Sentence",
  "Paragraph",
] as const;

export type EnglishAssessmentLevel = (typeof ENGLISH_ASSESSMENT_LEVELS)[number];

export interface QuizQuestion {
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

export interface QuizSection {
  id: string;
  title: string;
  description?: string;
}

export interface Quiz {
  id: number;
  title: string;
  phonemicLevel: EnglishAssessmentLevel;
  schedule: string;
  duration: number; // in minutes
  questions: QuizQuestion[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  students?: QuizStudent[];
  sections?: QuizSection[];
  responses?: QuizResponse[];
  subjectId?: number | null;
  phonemicId?: number | null;
  quizCode?: string | null;
  qrToken?: string | null;
  submittedCount?: number;
  assignedCount?: number;
}

const INITIAL_QUIZZES: Record<EnglishAssessmentLevel, Quiz[]> = {
  "Non Reader": [],
  Syllable: [],
  Word: [],
  Phrase: [],
  Sentence: [],
  Paragraph: [],
};

const STORAGE_KEY = "MASTER_TEACHER_ASSESSMENT_ENGLISH";

type QuizzesByLevel = Record<EnglishAssessmentLevel, Quiz[]>;

const generateSectionId = () => `section-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;

const ENGLISH_LEVEL_SET = new Set<EnglishAssessmentLevel>(ENGLISH_ASSESSMENT_LEVELS);

const normalizeStoredQuizzes = (raw: Record<string, Quiz[]>): QuizzesByLevel => {
  const normalized = ENGLISH_ASSESSMENT_LEVELS.reduce((acc, level) => {
    acc[level] = [];
    return acc;
  }, {} as QuizzesByLevel);

  Object.entries(raw).forEach(([key, quizzes]) => {
    if (!ENGLISH_LEVEL_SET.has(key as EnglishAssessmentLevel)) {
      return;
    }

    const level = key as EnglishAssessmentLevel;
    normalized[level] = (quizzes ?? []).map((item) => ({
      ...item,
      questions: item.questions.map((question) => ({
        ...question,
        options: Array.isArray(question.options) ? [...question.options] : undefined,
      })),
      sections: item.sections?.map((section) => ({ ...section })),
      students: (item.students ?? []).map((student) => ({ ...student })),
      responses: cloneResponses(item.responses),
    }));
  });

  return normalized;
};

function cloneInitialQuizzes(): QuizzesByLevel {
  return ENGLISH_ASSESSMENT_LEVELS.reduce((acc, level) => {
    acc[level] = INITIAL_QUIZZES[level].map((item) => ({
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
  }, {} as QuizzesByLevel);
}

function readStoredQuizzes(): QuizzesByLevel | null {
  if (typeof window === "undefined") return null;

  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  if (!storedValue) return null;

  try {
    const parsed = JSON.parse(storedValue) as Record<string, Quiz[]>;
    return normalizeStoredQuizzes(parsed);
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

const buildDefaultSection = (): QuizSection => ({
  id: generateSectionId(),
  title: "Section 1",
  description: "",
});

const mapAssessmentToQuiz = (assessment: any): Quiz => {
  const startDate = assessment.startDate ?? assessment.start_time ?? assessment.startTime ?? "";
  const endDate = assessment.endDate ?? assessment.end_time ?? assessment.endTime ?? "";
  const duration = calculateDurationMinutes(startDate, endDate, 30);
  const section = buildDefaultSection();
  const questions: QuizQuestion[] = (assessment.questions ?? []).map((question: any, index: number) => ({
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
    phonemicLevel: (assessment.phonemicLevel ?? assessment.phonemic_level_name ?? "Non Reader") as EnglishAssessmentLevel,
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
    assignedCount: Number(assessment.assignedCount ?? assessment.assigned_count ?? 0),
  };
};

const groupAssessmentsByLevel = (assessments: any[]): QuizzesByLevel => {
  const grouped = ENGLISH_ASSESSMENT_LEVELS.reduce((acc, level) => {
    acc[level] = [];
    return acc;
  }, {} as QuizzesByLevel);

  assessments.forEach((assessment) => {
    const level = assessment.phonemicLevel ?? assessment.phonemic_level_name;
    if (ENGLISH_LEVEL_SET.has(level as EnglishAssessmentLevel)) {
      grouped[level as EnglishAssessmentLevel].push(mapAssessmentToQuiz(assessment));
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

const getQuizScheduleStatus = (quiz: Quiz): QuizScheduleStatus => {
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
): QuizQuestion => {
  const section = sectionLookup.get(question.sectionId);
  const sectionTitle = section?.title ?? question.sectionTitle ?? "";

  const base: QuizQuestion = {
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
      : ["True", "False"];
  }

  return base;
};

const toModalQuestion = (
  question: QuizQuestion,
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
      : ["True", "False"];
  }

  return base;
};

const mapQuizDataToQuiz = (
  data: QuizData,
  level: EnglishAssessmentLevel,
  existing?: Quiz
): Quiz => {
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

const mapQuizToModalData = (quiz: Quiz): QuizData => {
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
    const resolvedSectionId = (question.sectionId && sectionLookup.has(question.sectionId))
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

interface EnglishAssessmentTabProps {
  level: EnglishAssessmentLevel;
}

export default function EnglishAssessmentTab({ level }: EnglishAssessmentTabProps) {
  const [quizzesByLevel, setQuizzesByLevel] = useState<QuizzesByLevel>(() => cloneInitialQuizzes());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [isResponsesOpen, setIsResponsesOpen] = useState(false);
  const [responsesQuiz, setResponsesQuiz] = useState<Quiz | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedQuizzes, setSelectedQuizzes] = useState<Set<number>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);

  const [pendingUpdateData, setPendingUpdateData] = useState<QuizData | null>(null);

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrQuiz, setQrQuiz] = useState<Quiz | null>(null);

  const quizzes = quizzesByLevel[level] ?? [];

  const reloadAssessments = async () => {
    const profile = getStoredUserProfile();
    const userId = profile?.userId;
    if (!userId) return;
    setCurrentUserId(String(userId));
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

  const saveQuizzes = (newQuizzes: QuizzesByLevel) => {
    setQuizzesByLevel(newQuizzes);
  };

  const handleCreateQuiz = () => {
    setEditingQuiz(null);
    setIsModalOpen(true);
  };

  const handleEditQuiz = (quiz: Quiz) => {
    if ((quiz.submittedCount ?? 0) > 0) {
      alert("This quiz already has submitted attempts and can no longer be edited.");
      return;
    }
    setEditingQuiz(quiz);
    setIsModalOpen(true);
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
          subjectName: "English",
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
          subjectName: "English",
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

  const getTeacherUserId = () => {
    const profile = getStoredUserProfile();
    return profile?.userId ? String(profile.userId) : "";
  };

  const handleViewResponses = (quiz: Quiz) => {
    const teacherUserId = getTeacherUserId();
    if (!quiz.quizCode) {
      alert("This quiz has no quiz code yet. Publish it first to view responses.");
      return;
    }
    if (!teacherUserId) {
      alert("Missing user information. Please log in again.");
      return;
    }
    setResponsesQuiz(quiz);
    setIsResponsesOpen(true);
  };

  const closeResponsesModal = () => {
    setIsResponsesOpen(false);
    setResponsesQuiz(null);
  };

  const handleShowQr = (quiz: Quiz) => {
    setQrQuiz(quiz);
    setIsQrModalOpen(true);
  };

  type TableRow = Quiz & { no: number };
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
            render: (row: TableRow) => {
              const submitted = row.submittedCount ?? 0;
              const assigned = row.assignedCount ?? 0;
              return (
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-700">
                    {assigned > 0 ? `${submitted}/${assigned}` : submitted}
                  </span>
                </div>
              );
            },
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
            <UtilityButton
              small
              onClick={() => handleEditQuiz(row)}
              disabled={(row.submittedCount ?? 0) > 0}
              title={(row.submittedCount ?? 0) > 0 ? "Cannot edit quiz with submissions" : "Edit Quiz"}
              className={(row.submittedCount ?? 0) > 0 ? "!bg-[#6c8f6c] !text-white opacity-80 cursor-not-allowed hover:!bg-[#6c8f6c] !border-[#6c8f6c]" : ""}
            >
              Edit
            </UtilityButton>
            <UtilityButton small onClick={() => handleViewResponses(row)}>
              Summary
            </UtilityButton>
            {row.isPublished && row.quizCode && (
              <button
                onClick={() => handleShowQr(row)}
                className="p-1.5 text-green-700 hover:bg-green-50 rounded-md transition-colors"
                title="Show QR Code"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <path d="M23 4C23 2.34315 21.6569 1 20 1H16C15.4477 1 15 1.44772 15 2C15 2.55228 15.4477 3 16 3H20C20.5523 3 21 3.44772 21 4V8C21 8.55228 21.4477 9 22 9C22.5523 9 23 8.55228 23 8V4Z" fill="#013300"></path>
                    <path d="M23 16C23 15.4477 22.5523 15 22 15C21.4477 15 21 15.4477 21 16V20C21 20.5523 20.5523 21 20 21H16C15.4477 21 15 21.4477 15 22C15 22.5523 15.4477 23 16 23H20C21.6569 23 23 21.6569 23 20V16Z" fill="#013300"></path>
                    <path d="M4 21C3.44772 21 3 20.5523 3 20V16C3 15.4477 2.55228 15 2 15C1.44772 15 1 15.4477 1 16V20C1 21.6569 2.34315 23 4 23H8C8.55228 23 9 22.5523 9 22C9 21.4477 8.55228 21 8 21H4Z" fill="#013300"></path>
                    <path d="M1 8C1 8.55228 1.44772 9 2 9C2.55228 9 3 8.55228 3 8V4C3 3.44772 3.44772 3 4 3H8C8.55228 3 9 2.55228 9 2C9 1.44772 8.55228 1 8 1H4C2.34315 1 1 2.34315 1 4V8Z" fill="#013300"></path>
                    <path fillRule="evenodd" clipRule="evenodd" d="M11 6C11 5.44772 10.5523 5 10 5H6C5.44772 5 5 5.44772 5 6V10C5 10.5523 5.44772 11 6 11H10C10.5523 11 11 10.5523 11 10V6ZM9 7.5C9 7.22386 8.77614 7 8.5 7H7.5C7.22386 7 7 7.22386 7 7.5V8.5C7 8.77614 7.22386 9 7.5 9H8.5C8.77614 9 9 8.77614 9 8.5V7.5Z" fill="#013300"></path>
                    <path fillRule="evenodd" clipRule="evenodd" d="M18 13C18.5523 13 19 13.4477 19 14V18C19 18.5523 18.5523 19 18 19H14C13.4477 19 13 18.5523 13 18V14C13 13.4477 13.4477 13 14 13H18ZM15 15.5C15 15.2239 15.2239 15 15.5 15H16.5C16.7761 15 17 15.2239 17 15.5V16.5C17 16.7761 16.7761 17 16.5 17H15.5C15.2239 17 15 16.7761 15 16.5V15.5Z" fill="#013300"></path>
                    <path d="M14 5C13.4477 5 13 5.44772 13 6C13 6.55229 13.4477 7 14 7H16.5C16.7761 7 17 7.22386 17 7.5V10C17 10.5523 17.4477 11 18 11C18.5523 11 19 10.5523 19 10V6C19 5.44772 18.5523 5 18 5H14Z" fill="#013300"></path>
                    <path d="M14 8C13.4477 8 13 8.44771 13 9V10C13 10.5523 13.4477 11 14 11C14.5523 11 15 10.5523 15 10V9C15 8.44772 14.5523 8 14 8Z" fill="#013300"></path>
                    <path d="M6 13C5.44772 13 5 13.4477 5 14V16C5 16.5523 5.44772 17 6 17C6.55229 17 7 16.5523 7 16V15.5C7 15.2239 7.22386 15 7.5 15H10C10.5523 15 11 14.5523 11 14C11 13.4477 10.5523 13 10 13H6Z" fill="#013300"></path>
                    <path d="M10 17C9.44771 17 9 17.4477 9 18C9 18.5523 9.44771 19 10 19C10.5523 19 11 18.5523 11 18C11 17.4477 10.5523 17 10 17Z" fill="#013300"></path>
                  </g>
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
        subject="English"
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
          totalStudents={responsesQuiz.assignedCount ?? responsesQuiz.students?.length ?? 0}
          quizCode={responsesQuiz.quizCode ?? undefined}
          teacherId={currentUserId ?? (getTeacherUserId() || undefined)}
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