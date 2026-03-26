"use client";
import { useEffect, useMemo, useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import AssessmentActionIconButton from "@/components/Common/Buttons/AssessmentActionIconButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import DeleteConfirmationModal from "../Modals/DeleteConfirmationModal";
import AddQuizModal, { type QuizData, type Student as QuizStudent, type Question as ModalQuestion, type Section as ModalSection } from "../Modals/AddQuizModal";
import ViewResponsesModal from "../Modals/ViewResponsesModal";
import ScheduledActivitiesList, { type CalendarActivity } from "@/modules/Teacher/remedial/ScheduledActivitiesList";
import { cloneResponses, type QuizResponse } from "../types";
import ToastActivity from "@/components/ToastActivity";
import { downloadPrintableQuizPdf } from "@/lib/assessments/printable";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import QrCodeModal from "../Modals/QrCodeModal";
import { buildQuizDraftFromSchedule, toScheduleDateKey } from "@/lib/assessments/schedule-utils";
import {
  createAssessment,
  deleteAssessment,
  fetchAssessmentSchedule,
  fetchAssessments,
  mapQuizQuestionsToPayload,
  updateAssessment,
} from "@/lib/assessments/client";

export const MATH_ASSESSMENT_LEVELS = [
  "Not Proficient",
  "Low Proficient",
  "Nearly Proficient",
  "Proficient",
  "Highly Proficient",
] as const;

const MATH_LEVEL_ALIASES: Record<string, MathAssessmentLevel> = {
  "Number Recognition": "Not Proficient",
  "Basic Operations": "Low Proficient",
  "Word Problems": "Nearly Proficient",
  Fractions: "Proficient",
  Geometry: "Highly Proficient",
  "Advanced Math": "Highly Proficient",
};

export type MathAssessmentLevel = (typeof MATH_ASSESSMENT_LEVELS)[number];

export interface MathQuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'problem-solving';
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  points: number;
  solution?: string; // For showing step-by-step solutions
  testNumber?: string;
  sectionId?: string;
  sectionTitle?: string;
}

export interface MathQuizSection {
  id: string;
  title: string;
  description?: string;
}

export interface MathQuiz {
  id: number;
  title: string;
  mathLevel: MathAssessmentLevel;
  schedule: string;
  duration: number; // in minutes
  questions: MathQuizQuestion[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  students?: QuizStudent[];
  sections?: MathQuizSection[];
  responses?: QuizResponse[];
  subjectId?: number | null;
  phonemicId?: number | null;
  quizCode?: string | null;
  qrToken?: string | null;
  submittedCount?: number;
  assignedCount?: number;
}

const INITIAL_MATH_QUIZZES: Record<MathAssessmentLevel, MathQuiz[]> = {
  "Not Proficient": [],
  "Low Proficient": [],
  "Nearly Proficient": [],
  "Proficient": [],
  "Highly Proficient": [],
};

const STORAGE_KEY = "MASTER_TEACHER_ASSESSMENT_MATH";

type MathQuizzesByLevel = Record<MathAssessmentLevel, MathQuiz[]>;

const generateSectionId = () => `section-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;

type QuizScheduleStatus = "Pending" | "Active" | "Completed";

const QUIZ_STATUS_STYLES: Record<QuizScheduleStatus, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Active: "bg-emerald-100 text-emerald-800",
  Completed: "bg-slate-200 text-slate-700",
};

const getQuizScheduleStatus = (quiz: MathQuiz): QuizScheduleStatus => {
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

const KNOWN_MATH_LEVELS = new Set<MathAssessmentLevel>(MATH_ASSESSMENT_LEVELS);

const createEmptyMathQuizzes = (): MathQuizzesByLevel =>
  MATH_ASSESSMENT_LEVELS.reduce((acc, level) => {
    acc[level] = [];
    return acc;
  }, {} as MathQuizzesByLevel);

const normalizeMathQuizzesRecord = (raw: Record<string, MathQuiz[]>): MathQuizzesByLevel => {
  const normalized = createEmptyMathQuizzes();

  Object.entries(raw).forEach(([key, quizzes]) => {
    const targetLevel = KNOWN_MATH_LEVELS.has(key as MathAssessmentLevel)
      ? (key as MathAssessmentLevel)
      : MATH_LEVEL_ALIASES[key];

    if (!targetLevel) {
      return;
    }

    normalized[targetLevel] = quizzes.map((quiz) => ({
      ...quiz,
      mathLevel: targetLevel,
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

function cloneInitialMathQuizzes(): MathQuizzesByLevel {
  return MATH_ASSESSMENT_LEVELS.reduce((acc, level) => {
    acc[level] = INITIAL_MATH_QUIZZES[level].map((item) => ({
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
  }, {} as MathQuizzesByLevel);
}

function readStoredMathQuizzes(): MathQuizzesByLevel | null {
  if (typeof window === "undefined") return null;

  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  if (!storedValue) return null;

  try {
    const parsed = JSON.parse(storedValue) as Record<string, MathQuiz[]>;
    return normalizeMathQuizzesRecord(parsed);
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
      hour: "2-digit",
      minute: "2-digit"
    });
};

const calculateDurationMinutes = (start?: string, end?: string, fallback = 20) => {
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

const buildDefaultSection = (): MathQuizSection => ({
  id: generateSectionId(),
  title: "Section 1",
  description: "",
});

const mapAssessmentToQuiz = (assessment: any): MathQuiz => {
  const startDate = assessment.startDate ?? assessment.start_time ?? assessment.startTime ?? "";
  const endDate = assessment.endDate ?? assessment.end_time ?? assessment.endTime ?? "";
  const duration = calculateDurationMinutes(startDate, endDate, 20);
  const fallbackSection = buildDefaultSection();
  const sections: MathQuizSection[] = Array.isArray(assessment.sections) && assessment.sections.length > 0
    ? assessment.sections.map((section: any, index: number) => ({
      id: String(section.id ?? `section-${assessment.assessment_id ?? assessment.id}-${index + 1}`),
      title: section.title ?? `Section ${index + 1}`,
      description: section.description ?? "",
    }))
    : [fallbackSection];

  const sectionByTitle = new Map<string, MathQuizSection>();
  sections.forEach((section) => {
    sectionByTitle.set(section.title.trim().toLowerCase(), section);
  });

  const questions: MathQuizQuestion[] = (assessment.questions ?? []).map((question: any, index: number) => ({
    id: String(question.id ?? index + 1),
    type: mapApiQuestionType(question.type ?? question.question_type ?? "short_answer"),
    question: question.question ?? question.questionText ?? "",
    options: Array.isArray(question.options) ? [...question.options] : question.choices?.map((choice: any) => choice.text) ?? undefined,
    correctAnswer: question.correctAnswer ?? question.correct_answer_text ?? "",
    points: Number(question.points ?? 1),
    sectionId:
      sectionByTitle.get((question.sectionTitle ?? question.section_title ?? "").toString().trim().toLowerCase())?.id ??
      sections[0].id,
    sectionTitle:
      question.sectionTitle ??
      question.section_title ??
      sections[0].title,
  }));

  return {
    id: Number(assessment.id ?? assessment.assessment_id ?? Date.now()),
    title: assessment.title ?? "",
    mathLevel: (assessment.phonemicLevel ?? assessment.phonemic_level_name ?? "Not Proficient") as MathAssessmentLevel,
    schedule: startDate,
    duration,
    questions,
    isPublished: Boolean(assessment.isPublished ?? assessment.is_published),
    createdAt: assessment.createdAt ?? assessment.created_at ?? new Date().toISOString(),
    updatedAt: assessment.updatedAt ?? assessment.updated_at ?? new Date().toISOString(),
    description: assessment.description ?? "",
    startDate,
    endDate,
    sections,
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

const groupAssessmentsByLevel = (assessments: any[]): MathQuizzesByLevel => {
  const grouped = createEmptyMathQuizzes();

  assessments.forEach((assessment) => {
    const level = assessment.phonemicLevel ?? assessment.phonemic_level_name;
    const normalizedLevel = MATH_LEVEL_ALIASES[level as keyof typeof MATH_LEVEL_ALIASES] ?? level;
    if (KNOWN_MATH_LEVELS.has(normalizedLevel as MathAssessmentLevel)) {
      grouped[normalizedLevel as MathAssessmentLevel].push(mapAssessmentToQuiz(assessment));
    }
  });

  return grouped;
};

const toQuizQuestion = (
  question: ModalQuestion,
  sectionLookup: Map<string, ModalSection>
): MathQuizQuestion => {
  const section = sectionLookup.get(question.sectionId);
  const sectionTitle = section?.title ?? question.sectionTitle ?? "";

  const base: MathQuizQuestion = {
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
  question: MathQuizQuestion,
  index: number,
  sectionId: string,
  sectionTitle: string
): ModalQuestion => {
  const coercedType: ModalQuestion["type"] =
    question.type === "problem-solving"
      ? "short-answer"
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
  level: MathAssessmentLevel,
  existing?: MathQuiz
): MathQuiz => {
  const now = new Date().toISOString();
  const duration = calculateDurationMinutes(data.startDate, data.endDate, existing?.duration ?? 20);
  const sectionLookup = new Map<string, ModalSection>();
  data.sections.forEach((section) => {
    sectionLookup.set(section.id, section);
  });

  const mappedQuestions = data.questions.map((question) => toQuizQuestion(question, sectionLookup));

  if (existing) {
    const existingSolutions = new Map(existing.questions.map((item) => [item.id, item.solution]));
    mappedQuestions.forEach((question) => {
      if (!question.solution && existingSolutions.has(question.id)) {
        question.solution = existingSolutions.get(question.id);
      }
    });
  }

  return {
    id: existing?.id ?? Date.now(),
    title: data.title.trim(),
    mathLevel: level,
    schedule: data.startDate,
    duration,
    questions: mappedQuestions,
    isPublished: existing?.isPublished ?? data.isPublished,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    description: data.description,
    startDate: data.startDate,
    endDate: data.endDate,
    students: data.students.map((student) => ({ ...student })),
    sections: data.sections.map((section) => ({ ...section })),
    responses: cloneResponses(existing?.responses),
    quizCode: (data as { quizCode?: string | null }).quizCode ?? existing?.quizCode ?? null,
    qrToken: (data as { qrToken?: string | null }).qrToken ?? existing?.qrToken ?? null,
  };
};

const mapQuizToModalData = (quiz: MathQuiz): QuizData => {
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
    phonemicLevel: quiz.mathLevel,
    students: (quiz.students ?? []).map((student) => ({ ...student })),
    questions,
    sections: normalizedSections,
    isPublished: quiz.isPublished,
  };
};

interface MathAssessmentTabProps {
  level: MathAssessmentLevel;
  onInitialLoadStateChange?: (loading: boolean) => void;
}

export default function MathAssessmentTab({ level, onInitialLoadStateChange }: MathAssessmentTabProps) {
  const [quizzesByLevel, setQuizzesByLevel] = useState<MathQuizzesByLevel>(() => cloneInitialMathQuizzes());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<MathQuiz | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedQuizzes, setSelectedQuizzes] = useState<Set<number>>(new Set());
  const [isResponsesOpen, setIsResponsesOpen] = useState(false);
  const [responsesQuiz, setResponsesQuiz] = useState<MathQuiz | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [assessmentsLoading, setAssessmentsLoading] = useState(true);

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrQuiz, setQrQuiz] = useState<MathQuiz | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusToast, setStatusToast] = useState<{
    title: string;
    message: string;
    tone: "success" | "error" | "info";
  } | null>(null);
  const [draftQuizData, setDraftQuizData] = useState<QuizData | null>(null);
  const [scheduleActivities, setScheduleActivities] = useState<CalendarActivity[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const quizzes = quizzesByLevel[level] ?? [];

  const getTeacherUserId = () => {
    const profile = getStoredUserProfile();
    return profile?.userId ? String(profile.userId) : "";
  };

  const loadAssessments = async (
    teacherUserId: string,
    options?: {
      showInitialLoading?: boolean;
    },
  ) => {
    if (options?.showInitialLoading) {
      setAssessmentsLoading(true);
    }

    try {
      const assessments = await fetchAssessments({
        creatorId: teacherUserId,
        creatorRole: "teacher",
        subjectName: "Math",
      });
      setQuizzesByLevel(groupAssessmentsByLevel(assessments));
    } finally {
      if (options?.showInitialLoading) {
        setAssessmentsLoading(false);
      }
    }
  };

  useEffect(() => {
    const profile = getStoredUserProfile();
    if (profile?.userId) {
      setCurrentUserId(String(profile.userId));
      void loadAssessments(String(profile.userId), { showInitialLoading: true });
      return;
    }
    setAssessmentsLoading(false);
  }, []);

  useEffect(() => {
    if (!statusToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setStatusToast(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [statusToast]);

  useEffect(() => {
    let cancelled = false;

    const loadSchedule = async () => {
      setScheduleLoading(true);
      setScheduleError(null);
      try {
        const activities = await fetchAssessmentSchedule();
        if (!cancelled) {
          setScheduleActivities(activities);
        }
      } catch (error) {
        if (!cancelled) {
          setScheduleActivities([]);
          setScheduleError(error instanceof Error ? error.message : "Unable to load assessment schedule.");
        }
      } finally {
        if (!cancelled) {
          setScheduleLoading(false);
        }
      }
    };

    void loadSchedule();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onInitialLoadStateChange?.(assessmentsLoading || scheduleLoading);
  }, [assessmentsLoading, onInitialLoadStateChange, scheduleLoading]);

  const saveQuizzes = (newQuizzes: MathQuizzesByLevel) => {
    setQuizzesByLevel(newQuizzes);
  };

  const handleCreateQuizForActivity = (activity: CalendarActivity) => {
    setEditingQuiz(null);
    setDraftQuizData(buildQuizDraftFromSchedule("Math", level, activity.date, activity.startTime, activity.endTime));
    setIsModalOpen(true);
  };

  const handleEditQuiz = (quiz: MathQuiz) => {
    if ((quiz.submittedCount ?? 0) > 0) {
      setStatusToast({
        title: "Edit Blocked",
        message: "This quiz already has submitted attempts and can no longer be edited.",
        tone: "info",
      });
      return;
    }
    setEditingQuiz(quiz);
    setDraftQuizData(null);
    setIsModalOpen(true);
  };

  const handleViewResponses = (quiz: MathQuiz) => {
    const teacherUserId = getTeacherUserId();
    if (!quiz.quizCode) {
      setStatusToast({
        title: "No Quiz Code",
        message: "This quiz has no quiz code yet. Publish it first to view responses.",
        tone: "info",
      });
      return;
    }
    if (!teacherUserId) {
      setStatusToast({
        title: "Session Required",
        message: "Missing user information. Please log in again.",
        tone: "error",
      });
      return;
    }
    setResponsesQuiz(quiz);
    setIsResponsesOpen(true);
  };

  const closeResponsesModal = () => {
    setIsResponsesOpen(false);
    setResponsesQuiz(null);
  };

  const handleShowQr = (quiz: MathQuiz) => {
    setQrQuiz(quiz);
    setIsQrModalOpen(true);
  };

  const handleDownloadQuiz = (quiz: MathQuiz) => {
    downloadPrintableQuizPdf({
      quiz,
      subjectLabel: "Math",
      levelLabel: quiz.mathLevel,
    });
  };

  const handleDeleteSelected = () => {
    if (selectedQuizzes.size === 0) return;
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    const teacherUserId = getTeacherUserId();
    if (!teacherUserId) {
      setStatusToast({
        title: "Session Required",
        message: "Missing user information. Please log in again.",
        tone: "error",
      });
      return;
    }

    try {
      setIsSaving(true);
      await Promise.all(Array.from(selectedQuizzes).map((quizId) => deleteAssessment(quizId)));
      await loadAssessments(teacherUserId);
      setSelectedQuizzes(new Set());
      setSelectMode(false);
      setShowDeleteModal(false);
      setStatusToast({
        title: "Delete Successful",
        message: "Selected quiz records were deleted.",
        tone: "success",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete quiz.";
      setStatusToast({
        title: "Delete Failed",
        message,
        tone: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveQuiz = async (quizData: QuizData) => {
    const teacherUserId = getTeacherUserId();
    if (!teacherUserId) {
      setStatusToast({
        title: "Session Required",
        message: "Missing user information. Please log in again.",
        tone: "error",
      });
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        title: quizData.title,
        description: quizData.description,
        subjectId: editingQuiz?.subjectId ?? null,
        subjectName: "Math",
        phonemicId: editingQuiz?.phonemicId ?? null,
        phonemicLevel: level,
        createdBy: teacherUserId,
        creatorRole: "teacher" as const,
        startTime: quizData.startDate,
        endTime: quizData.endDate,
        isPublished: quizData.isPublished,
        sections: quizData.sections.map((section) => ({
          id: section.id,
          title: section.title,
          description: section.description ?? "",
        })),
        questions: mapQuizQuestionsToPayload(quizData.questions, quizData.sections),
      };

      if (editingQuiz) {
        await updateAssessment(editingQuiz.id, payload);
      } else {
        await createAssessment(payload);
      }

      await loadAssessments(teacherUserId);
      setIsModalOpen(false);
      setEditingQuiz(null);
      setDraftQuizData(null);
      setStatusToast({
        title: "Save Successful",
        message: editingQuiz ? "Quiz changes were saved." : "Quiz was created successfully.",
        tone: "success",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save quiz.";
      setStatusToast({
        title: "Save Failed",
        message,
        tone: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const togglePublish = (quizId: number) => {
    const updatedQuizzes = {
      ...quizzesByLevel,
      [level]: quizzesByLevel[level].map(quiz =>
        quiz.id === quizId
          ? { ...quiz, isPublished: !quiz.isPublished, updatedAt: new Date().toISOString() }
          : quiz
      )
    };
    saveQuizzes(updatedQuizzes);
  };

  const quizzesByDate = useMemo(() => {
    const mapped = new Map<string, MathQuiz>();
    quizzes.forEach((quiz) => {
      const key = toScheduleDateKey(quiz.startDate ?? quiz.schedule);
      if (key && !mapped.has(key)) {
        mapped.set(key, quiz);
      }
    });
    return mapped;
  }, [quizzes]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2">
        <h2 className="text-lg font-bold text-gray-800">Scheduled Assessments (Math)</h2>
      </div>

      <div className="flex-1 min-h-0 px-4 sm:px-6 pb-4 sm:pb-6">
        <ScheduledActivitiesList
          activities={scheduleActivities}
          subject="Math"
          loading={scheduleLoading}
          error={scheduleError}
          renderTitle={(activity, { isCurrentAnchor }) => {
            const quiz = quizzesByDate.get(toScheduleDateKey(activity.date) ?? "");
            return (
              <span className="flex flex-col gap-1">
                <span>{quiz?.title ?? `Math Assessment (${level})`}</span>
                {quiz?.quizCode ? (
                  <span
                    className={`font-mono text-xs font-semibold uppercase tracking-[0.18em] ${
                      isCurrentAnchor ? "text-white/85" : "text-slate-500"
                    }`}
                  >
                    Code: {quiz.quizCode}
                  </span>
                ) : null}
              </span>
            );
          }}
          renderActions={(activity) => {
            const quiz = quizzesByDate.get(toScheduleDateKey(activity.date) ?? "");

            if (!quiz) {
              return (
                <UtilityButton small onClick={() => handleCreateQuizForActivity(activity)} className="py-2! px-4!">
                  Create
                </UtilityButton>
              );
            }

            return (
              <div className="flex gap-2">
                <AssessmentActionIconButton
                  action="edit"
                  onClick={() => handleEditQuiz(quiz)}
                  disabled={isSaving || (quiz.submittedCount ?? 0) > 0}
                  title={(quiz.submittedCount ?? 0) > 0 ? "Cannot edit quiz with responses" : undefined}
                />
                <AssessmentActionIconButton action="summary" onClick={() => handleViewResponses(quiz)} />
                <AssessmentActionIconButton action="download" onClick={() => handleDownloadQuiz(quiz)} />
                {quiz.quizCode && (
                  <UtilityButton
                    small
                    onClick={() => handleShowQr(quiz)}
                    title="Show QR Code"
                    className="p-1.5!"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 4H10V10H4V4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 4H20V10H14V4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 14H10V20H4V14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 14H17V17H14V14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M17 17H20V20H17V20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M17 14H20V17H17V14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 17H17V20H14V17Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </UtilityButton>
                )}
              </div>
            );
          }}
        />
      </div>

      {/* Quiz Creation/Editing Modal */}
      <AddQuizModal
        isOpen={isModalOpen}
        isEditing={Boolean(editingQuiz)}
        onClose={() => {
          setIsModalOpen(false);
          setEditingQuiz(null);
          setDraftQuizData(null);
        }}
        onSave={handleSaveQuiz}
        initialData={editingQuiz ? mapQuizToModalData(editingQuiz) : draftQuizData ?? undefined}
        level={level}
        subject="Math"
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

      <DeleteConfirmationModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        entityLabel={selectedQuizzes.size === 1 ? "quiz" : "quizzes"}
        description={`Are you sure you want to delete ${selectedQuizzes.size} selected quiz${selectedQuizzes.size === 1 ? '' : 'zes'}? This action cannot be undone.`}
      />
      {statusToast && (
        <ToastActivity
          title={statusToast.title}
          message={statusToast.message}
          tone={statusToast.tone}
          onClose={() => setStatusToast(null)}
        />
      )}
    </div>
  );
}
