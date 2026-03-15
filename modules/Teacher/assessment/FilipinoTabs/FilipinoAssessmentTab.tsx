"use client";
import { useEffect, useMemo, useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import AssessmentActionIconButton from "@/components/Common/Buttons/AssessmentActionIconButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import AddQuizModal, { type QuizData, type Student as QuizStudent, type Question as ModalQuestion, type Section as ModalSection } from "../Modals/AddQuizModal";
import ViewResponsesModal from "../Modals/ViewResponsesModal";
import DeleteConfirmationModal from "../Modals/DeleteConfirmationModal";
import UpdateConfirmationModal from "../Modals/UpdateConfirmationModal";
import QrCodeModal from "../Modals/QrCodeModal";
import ScheduledActivitiesList, { type CalendarActivity } from "@/modules/Teacher/remedial/ScheduledActivitiesList";
import { cloneResponses, type QuizResponse } from "../types";
import ToastActivity from "@/components/ToastActivity";
import { downloadPrintableQuizPdf } from "@/lib/assessments/printable";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import { buildQuizDraftFromSchedule, toScheduleDateKey } from "@/lib/assessments/schedule-utils";
import {
  createAssessment,
  deleteAssessment,
  fetchAssessmentSchedule,
  fetchAssessments,
  mapQuizQuestionsToPayload,
  updateAssessment,
} from "@/lib/assessments/client";

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

const normalizePhonemicKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const FILIPINO_LEVEL_KEY_MAP: Record<string, FilipinoAssessmentLevel> = {
  nonreader: "Non Reader",
  syllable: "Syllable",
  syllables: "Syllable",
  word: "Word",
  words: "Word",
  phrase: "Phrase",
  phrases: "Phrase",
  sentence: "Sentence",
  sentences: "Sentence",
  paragraph: "Paragraph",
  paragraphs: "Paragraph",
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
  assignedCount?: number;
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

const normalizeFilipinoLevel = (value?: string | null): FilipinoAssessmentLevel | null => {
  if (!value) return null;
  if (KNOWN_FILIPINO_LEVELS.has(value as FilipinoAssessmentLevel)) {
    return value as FilipinoAssessmentLevel;
  }
  const alias = FILIPINO_LEVEL_ALIASES[value as keyof typeof FILIPINO_LEVEL_ALIASES];
  if (alias) return alias;
  const normalizedKey = normalizePhonemicKey(value);
  return FILIPINO_LEVEL_KEY_MAP[normalizedKey] ?? null;
};

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
  const fallbackSection = buildDefaultSection();
  const sections: FilipinoQuizSection[] = Array.isArray(assessment.sections) && assessment.sections.length > 0
    ? assessment.sections.map((section: any, index: number) => ({
      id: String(section.id ?? `section-${assessment.assessment_id ?? assessment.id}-${index + 1}`),
      title: section.title ?? `Section ${index + 1}`,
      description: section.description ?? "",
    }))
    : [fallbackSection];

  const sectionByTitle = new Map<string, FilipinoQuizSection>();
  sections.forEach((section) => {
    sectionByTitle.set(section.title.trim().toLowerCase(), section);
  });

  const normalizedLevel =
    normalizeFilipinoLevel(assessment.phonemicLevel ?? assessment.phonemic_level_name) ?? "Non Reader";
  const questions: FilipinoQuizQuestion[] = (assessment.questions ?? []).map((question: any, index: number) => ({
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
    phonemicLevel: normalizedLevel,
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

const groupAssessmentsByLevel = (assessments: any[]): FilipinoQuizzesByLevel => {
  const grouped = createEmptyFilipinoQuizzes();

  assessments.forEach((assessment) => {
    const level = normalizeFilipinoLevel(assessment.phonemicLevel ?? assessment.phonemic_level_name);
    if (level && KNOWN_FILIPINO_LEVELS.has(level)) {
      grouped[level].push(mapAssessmentToQuiz({ ...assessment, phonemicLevel: level }));
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
  const quizCode = "quizCode" in data ? (data as { quizCode?: string | null }).quizCode : undefined;
  const qrToken = "qrToken" in data ? (data as { qrToken?: string | null }).qrToken : undefined;
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
    quizCode: quizCode ?? existing?.quizCode ?? null,
    qrToken: qrToken ?? existing?.qrToken ?? null,
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusToast, setStatusToast] = useState<{
    title: string;
    message: string;
    tone: "success" | "error" | "info";
  } | null>(null);

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrQuiz, setQrQuiz] = useState<FilipinoQuiz | null>(null);
  const [draftQuizData, setDraftQuizData] = useState<QuizData | null>(null);
  const [scheduleActivities, setScheduleActivities] = useState<CalendarActivity[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const quizzes = quizzesByLevel[level] ?? [];

  useEffect(() => {
    if (!statusToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setStatusToast(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [statusToast]);

  const loadAssessments = async (teacherUserId: string) => {
    const assessments = await fetchAssessments({
      creatorId: teacherUserId,
      creatorRole: "teacher",
      subjectName: "Filipino",
    });
    setQuizzesByLevel(groupAssessmentsByLevel(assessments));
  };

  useEffect(() => {
    const profile = getStoredUserProfile();
    if (profile?.userId) {
      setCurrentUserId(String(profile.userId));
      void loadAssessments(String(profile.userId));
    }
  }, []);

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

  const saveQuizzes = (newQuizzes: FilipinoQuizzesByLevel) => {
    setQuizzesByLevel(newQuizzes);
  };

  const handleCreateQuizForActivity = (activity: CalendarActivity) => {
    setEditingQuiz(null);
    setDraftQuizData(buildQuizDraftFromSchedule("Filipino", level, activity.date, activity.startTime, activity.endTime));
    setIsModalOpen(true);
  };

  const handleEditQuiz = (quiz: FilipinoQuiz) => {
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

  const getTeacherUserId = () => {
    const profile = getStoredUserProfile();
    return profile?.userId ? String(profile.userId) : "";
  };

  const handleViewResponses = (quiz: FilipinoQuiz) => {
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

  const handleShowQr = (quiz: FilipinoQuiz) => {
    setQrQuiz(quiz);
    setIsQrModalOpen(true);
  };

  const handleDownloadQuiz = (quiz: FilipinoQuiz) => {
    downloadPrintableQuizPdf({
      quiz,
      subjectLabel: "Filipino",
      levelLabel: quiz.phonemicLevel,
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
        subjectName: "Filipino",
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

  const confirmUpdateQuiz = () => {
    if (!editingQuiz || !pendingUpdateData) {
      setIsUpdateConfirmOpen(false);
      setPendingUpdateData(null);
      return;
    }

    const newQuiz = mapQuizDataToQuiz(pendingUpdateData, level, editingQuiz);
    const updatedQuizzes = {
      ...quizzesByLevel,
      [level]: quizzesByLevel[level].map(q => q.id === editingQuiz.id ? newQuiz : q)
    };
    saveQuizzes(updatedQuizzes);
    setIsUpdateConfirmOpen(false);
    setPendingUpdateData(null);
    setIsModalOpen(false);
    setEditingQuiz(null);
  };

  const cancelUpdateQuiz = () => {
    setIsUpdateConfirmOpen(false);
    setPendingUpdateData(null);
  };

  const quizzesByDate = useMemo(() => {
    const mapped = new Map<string, FilipinoQuiz>();
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
        <h2 className="text-lg font-bold text-gray-800">Scheduled Assessments (Filipino)</h2>
      </div>

      <div className="flex-1 min-h-0 px-4 sm:px-6 pb-4 sm:pb-6">
        <ScheduledActivitiesList
          activities={scheduleActivities}
          subject="Filipino"
          loading={scheduleLoading}
          error={scheduleError}
          renderTitle={(activity, { isCurrentAnchor }) => {
            const quiz = quizzesByDate.get(toScheduleDateKey(activity.date) ?? "");
            return (
              <span className="flex flex-col gap-1">
                <span>{quiz?.title ?? `Filipino Assessment (${level})`}</span>
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
          if (isSaving) return;
          setIsModalOpen(false);
          setEditingQuiz(null);
          setDraftQuizData(null);
          setPendingUpdateData(null);
          setIsUpdateConfirmOpen(false);
        }}
        onSave={handleSaveQuiz}
        initialData={editingQuiz ? mapQuizToModalData(editingQuiz) : draftQuizData ?? undefined}
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
