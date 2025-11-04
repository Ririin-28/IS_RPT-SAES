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
import { cloneResponses, type QuizResponse } from "../types";

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
}

const INITIAL_QUIZZES: Record<EnglishAssessmentLevel, Quiz[]> = {
  "Non Reader": [
    {
      id: 1,
      title: "Basic Phonemic Awareness Quiz",
      phonemicLevel: "Non Reader",
      schedule: "2024-06-15T10:00:00",
      startDate: "2024-06-15T10:00:00",
      endDate: "2024-06-15T10:30:00",
      duration: 30,
      sections: [
        {
          id: "english-non-reader-test-i",
          title: "Test I",
          description: "",
        },
      ],
      questions: [
        {
          id: "1",
          type: "multiple-choice",
          question: "Which word starts with the 'b' sound?",
          options: ["Ball", "Call", "Tall", "Fall"],
          correctAnswer: "Ball",
          points: 5,
          testNumber: "Test I",
          sectionId: "english-non-reader-test-i",
          sectionTitle: "Test I",
        }
      ],
      isPublished: true,
      createdAt: "2024-06-01",
      updatedAt: "2024-06-01",
      description: "Phonemic awareness practice covering initial sounds.",
      students: [],
      responses: [
        {
          id: "resp-eng-001",
          studentId: "S001",
          studentName: "Juan Dela Cruz",
          submittedAt: "2024-06-14T09:15:00",
          score: 5,
          answers: {
            "1": "Ball",
          },
        },
        {
          id: "resp-eng-002",
          studentId: "S002",
          studentName: "Maria Santos",
          submittedAt: "2024-06-14T10:05:00",
          score: 0,
          answers: {
            "1": "Call",
          },
        },
      ],
    }
  ],
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);
  const [pendingUpdateData, setPendingUpdateData] = useState<QuizData | null>(null);

  const quizzes = quizzesByLevel[level] ?? [];

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = readStoredQuizzes();
    if (stored) {
      setQuizzesByLevel(stored);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cloneInitialQuizzes()));
    }
  }, []);

  const saveQuizzes = (newQuizzes: QuizzesByLevel) => {
    setQuizzesByLevel(newQuizzes);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newQuizzes));
  };

  const handleCreateQuiz = () => {
    setEditingQuiz(null);
    setIsModalOpen(true);
  };

  const handleEditQuiz = (quiz: Quiz) => {
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

    const newQuiz = mapQuizDataToQuiz(quizData, level);
    const updatedQuizzes = {
      ...quizzesByLevel,
      [level]: [...quizzesByLevel[level], newQuiz],
    };
    saveQuizzes(updatedQuizzes);
    setIsModalOpen(false);
    setEditingQuiz(null);
  };

  const confirmUpdateQuiz = () => {
    if (!editingQuiz || !pendingUpdateData) {
      setIsUpdateConfirmOpen(false);
      setPendingUpdateData(null);
      return;
    }

    const updatedQuiz = mapQuizDataToQuiz(pendingUpdateData, level, editingQuiz);
    const updatedQuizzes = {
      ...quizzesByLevel,
      [level]: quizzesByLevel[level].map((quiz) =>
        quiz.id === editingQuiz.id ? updatedQuiz : quiz
      ),
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

  const handleViewResponses = (quiz: Quiz) => {
    setResponsesQuiz(quiz);
    setIsResponsesOpen(true);
  };

  const closeResponsesModal = () => {
    setIsResponsesOpen(false);
    setResponsesQuiz(null);
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
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                    <path d="M3 6h18"/>
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
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