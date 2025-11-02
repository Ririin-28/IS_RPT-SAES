"use client";
import { useEffect, useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";
import KebabMenu from "@/components/Common/Menus/KebabMenu";
import DeleteConfirmationModal from "@/components/Common/Modals/DeleteConfirmationModal";
import AddQuizModal, { type QuizData, type Student as QuizStudent, type Question as ModalQuestion, type Section as ModalSection } from "../Modals/AddQuizModal";
import ViewResponsesModal from "../Modals/ViewResponsesModal";
import { cloneResponses, type QuizResponse } from "../types";

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
}

const INITIAL_MATH_QUIZZES: Record<MathAssessmentLevel, MathQuiz[]> = {
  "Not Proficient": [
    {
      id: 1,
      title: "Basic Number Identification Quiz",
      mathLevel: "Not Proficient",
      schedule: "2024-06-15T10:00:00",
      startDate: "2024-06-15T10:00:00",
      endDate: "2024-06-15T10:20:00",
      duration: 20,
      sections: [
        {
          id: "math-not-proficient-test-i",
          title: "Test I",
          description: "",
        },
      ],
      questions: [
        {
          id: "1",
          type: "multiple-choice",
          question: "Which number comes after 5?",
          options: ["4", "5", "6", "7"],
          correctAnswer: "6",
          points: 5,
          testNumber: "Test I",
          sectionId: "math-not-proficient-test-i",
          sectionTitle: "Test I",
        }
      ],
      isPublished: true,
      createdAt: "2024-06-01",
      updatedAt: "2024-06-01",
      description: "Identify succeeding numbers within the first ten.",
      students: [],
      responses: [],
    }
  ],
  "Low Proficient": [],
  "Nearly Proficient": [],
  "Proficient": [],
  "Highly Proficient": [],
};

const STORAGE_KEY = "MASTER_TEACHER_ASSESSMENT_MATH";

type MathQuizzesByLevel = Record<MathAssessmentLevel, MathQuiz[]>;

const generateSectionId = () => `section-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;

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
        year: "numeric",
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
}

export default function MathAssessmentTab({ level }: MathAssessmentTabProps) {
  const [quizzesByLevel, setQuizzesByLevel] = useState<MathQuizzesByLevel>(() => cloneInitialMathQuizzes());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<MathQuiz | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedQuizzes, setSelectedQuizzes] = useState<Set<number>>(new Set());
  const [isResponsesOpen, setIsResponsesOpen] = useState(false);
  const [responsesQuiz, setResponsesQuiz] = useState<MathQuiz | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const quizzes = quizzesByLevel[level] ?? [];

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = readStoredMathQuizzes();
    if (stored) {
      setQuizzesByLevel(stored);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cloneInitialMathQuizzes()));
    }
  }, []);

  const saveQuizzes = (newQuizzes: MathQuizzesByLevel) => {
    setQuizzesByLevel(newQuizzes);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newQuizzes));
  };

  const handleCreateQuiz = () => {
    setEditingQuiz(null);
    setIsModalOpen(true);
  };

  const handleEditQuiz = (quiz: MathQuiz) => {
    setEditingQuiz(quiz);
    setIsModalOpen(true);
  };

  const handleViewResponses = (quiz: MathQuiz) => {
    setResponsesQuiz(quiz);
    setIsResponsesOpen(true);
  };

  const closeResponsesModal = () => {
    setIsResponsesOpen(false);
    setResponsesQuiz(null);
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
      const updatedQuiz = mapQuizDataToQuiz(quizData, level, editingQuiz);
      const updatedQuizzes = {
        ...quizzesByLevel,
        [level]: quizzesByLevel[level].map((quiz) =>
          quiz.id === editingQuiz.id ? updatedQuiz : quiz
        ),
      };
      saveQuizzes(updatedQuizzes);
    } else {
      const newQuiz = mapQuizDataToQuiz(quizData, level);
      const updatedQuizzes = {
        ...quizzesByLevel,
        [level]: [...quizzesByLevel[level], newQuiz],
      };
      saveQuizzes(updatedQuizzes);
    }
    setIsModalOpen(false);
    setEditingQuiz(null);
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

  type TableRow = MathQuiz & { no: number };
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
          { key: "mathLevel", title: "Phonemic" },
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
            key: "isPublished",
            title: "Status",
            render: (row: TableRow) => (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                row.isPublished 
                  ? "bg-green-100 text-green-800" 
                  : "bg-gray-100 text-gray-800"
              }`}>
                {row.isPublished ? "Active" : "Inactive"}
              </span>
            ),
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
        {...({
          isOpen: isModalOpen,
          onClose: () => {
            setIsModalOpen(false);
            setEditingQuiz(null);
          },
          onSave: handleSaveQuiz,
          initialData: editingQuiz ? mapQuizToModalData(editingQuiz) : undefined,
          level: level,
          subject: "Math",
        } as any)}
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

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Confirm Delete"
        message={`Are you sure you want to delete ${selectedQuizzes.size} selected quiz${selectedQuizzes.size > 1 ? 'zes' : ''}? This action cannot be undone.`}
      />
    </div>
  );
}