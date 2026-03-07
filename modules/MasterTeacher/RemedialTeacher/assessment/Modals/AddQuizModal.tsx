"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Flatpickr from "react-flatpickr";
import type { Options as FlatpickrOptions } from "flatpickr/dist/types/options";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import BaseModal, { ModalSection, ModalLabel } from "@/components/Common/Modals/BaseModal";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Section {
  id: string;
  title: string;
  description?: string;
}

export interface Question {
  id: string;
  sectionId: string;
  sectionTitle?: string;
  type: 'short-answer' | 'multiple-choice' | 'true-false';
  question: string;
  options?: string[];
  correctAnswer: string;
  points: number;
}

export interface QuizData {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  phonemicLevel: string;
  students: Student[];
  questions: Question[];
  sections: Section[];
  isPublished: boolean;
  quizCode?: string | null;
  qrToken?: string | null;
}

interface AddQuizModalProps {
  isOpen?: boolean;
  show?: boolean;
  onClose: () => void;
  onSave: (quizData: QuizData) => void;
  initialData?: QuizData;
  level: string;
  subject: "English" | "Filipino" | "Math";
}

// Mock student data - in real app, this would come from props or API
const MOCK_STUDENTS: Student[] = [
  { id: "S001", firstName: "Juan", lastName: "Dela Cruz" },
  { id: "S002", firstName: "Maria", lastName: "Santos" },
  { id: "S003", firstName: "Pedro", lastName: "Reyes" },
];

const DATE_TIME_ALT_INPUT_CLASS =
  "flatpickr-alt-input w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#013300]";

const FIELD_INPUT_CLASS =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#013300] focus:ring-1 focus:ring-[#013300]";

const FIELD_TEXTAREA_CLASS = `${FIELD_INPUT_CLASS} resize-y min-h-[88px]`;

const READONLY_INPUT_CLASS =
  "w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600";

const FIELD_SELECT_CLASS =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#013300] focus:ring-1 focus:ring-[#013300]";

const INLINE_ACTION_CLASS =
  "text-sm font-medium text-gray-600 transition hover:text-[#013300]";

const DESTRUCTIVE_ACTION_CLASS =
  "text-sm font-medium text-red-600 transition hover:text-red-800";

const FLAT_ACTION_BUTTON_CLASS =
  "inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50";

const ICON_ACTION_BUTTON_CLASS =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700";

const formatDateForPickerValue = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const normalizePickerValue = (value: string) => {
  if (!value) return "";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  return formatDateForPickerValue(new Date(timestamp));
};

const parsePickerBoundary = (value: string) => {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
};

const generateId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `id-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
};

const createDefaultSection = (index: number): Section => ({
  id: generateId(),
  title: `Section ${index}`,
  description: "",
});

const prepareInitialStructure = (initialData?: QuizData) => {
  const baseSections = initialData?.sections ?? [];
  const normalizedSections: Section[] = baseSections.length
    ? baseSections.map((section, index) => ({
        id: section.id || generateId(),
        title: section.title?.trim() || `Section ${index + 1}`,
        description: section.description ?? "",
      }))
    : [];

  const sectionMap = new Map<string, Section>();
  const titleToId = new Map<string, string>();

  normalizedSections.forEach((section) => {
    sectionMap.set(section.id, section);
    titleToId.set(section.title.trim().toLowerCase(), section.id);
  });

  const normalizedQuestions: Question[] = (initialData?.questions ?? []).map((question, index) => {
    const possibleTitles: string[] = [];

    if (question.sectionTitle && question.sectionTitle.trim()) {
      possibleTitles.push(question.sectionTitle.trim());
    }

    const legacyTestNumber = (question as unknown as { testNumber?: string }).testNumber;
    if (legacyTestNumber && legacyTestNumber.trim()) {
      possibleTitles.push(legacyTestNumber.trim());
    }

    let sectionId = question.sectionId && sectionMap.has(question.sectionId)
      ? question.sectionId
      : undefined;

    if (!sectionId) {
      for (const candidate of possibleTitles) {
        const match = titleToId.get(candidate.toLowerCase());
        if (match) {
          sectionId = match;
          break;
        }
      }
    }

    if (!sectionId) {
      const fallbackTitle = possibleTitles[0] ?? `Section ${sectionMap.size + 1}`;
      const normalizedTitle = fallbackTitle.trim() || `Section ${sectionMap.size + 1}`;
      const newSection = {
        id: generateId(),
        title: normalizedTitle,
        description: "",
      } satisfies Section;
      sectionId = newSection.id;
      sectionMap.set(newSection.id, newSection);
      titleToId.set(normalizedTitle.toLowerCase(), newSection.id);
    }

    const owningSection = sectionMap.get(sectionId);

    return {
      ...question,
      sectionId,
      sectionTitle: owningSection?.title ?? possibleTitles[0] ?? `Section ${index + 1}`,
    };
  });

  const sections = sectionMap.size
    ? Array.from(sectionMap.values())
    : [createDefaultSection(1)];

  return {
    sections,
    questions: normalizedQuestions,
  };
};

const generateQuizCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const generateQrToken = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export default function AddQuizModal({ isOpen, show, onClose, onSave, initialData, level, subject }: AddQuizModalProps) {
  const open = isOpen ?? show ?? false;
  const isAutoSettingStartDateRef = useRef(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [sections, setSections] = useState<Section[]>(() => [createDefaultSection(1)]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [students, setStudents] = useState<Student[]>(MOCK_STUDENTS);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      setStartDate(normalizePickerValue(initialData.startDate ?? ""));
      setEndDate(normalizePickerValue(initialData.endDate ?? ""));
      setIsPublished(initialData.isPublished ?? false);
      const { sections: initialSections, questions: initialQuestions } = prepareInitialStructure(initialData);
      setSections(initialSections);
      setQuestions(initialQuestions);
      if (initialData.students && initialData.students.length > 0) {
        setStudents(initialData.students);
      } else {
        setStudents(MOCK_STUDENTS);
      }
    } else {
      setTitle("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setIsPublished(false);
      setSections([createDefaultSection(1)]);
      setQuestions([]);
      setStudents(MOCK_STUDENTS);
    }
  }, [initialData, open]);

  const addSection = () => {
    const nextIndex = sections.length + 1;
    const newSection = createDefaultSection(nextIndex);
    setSections((prev) => [...prev, newSection]);
  };

  const updateSection = (sectionId: string, field: keyof Section, value: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, [field]: value }
          : section
      )
    );

    if (field === "title") {
      setQuestions((prev) =>
        prev.map((question) =>
          question.sectionId === sectionId
            ? { ...question, sectionTitle: value }
            : question
        )
      );
    }
  };

  const removeSection = (sectionId: string) => {
    if (sections.length <= 1) {
      return;
    }

    setSections((prev) => prev.filter((section) => section.id !== sectionId));
    setQuestions((prev) => prev.filter((question) => question.sectionId !== sectionId));
  };

  const addQuestionToSection = (sectionId: string) => {
    const owningSection = sections.find((section) => section.id === sectionId);
    const newQuestion: Question = {
      id: generateId(),
      sectionId,
      sectionTitle: owningSection?.title,
      type: 'multiple-choice',
      question: '',
      options: ['', '', '', ''],
      correctAnswer: '',
      points: 1,
    };
    setQuestions((prev) => [...prev, newQuestion]);
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    
    // If changing to true-false, set options automatically
    if (field === 'type' && value === 'true-false') {
      updatedQuestions[index].options = ['True', 'False'];
      updatedQuestions[index].correctAnswer = '';
    } else if (field === 'type' && value === 'multiple-choice') {
      updatedQuestions[index].options = ['', '', '', ''];
      updatedQuestions[index].correctAnswer = '';
    } else if (field === 'type' && value === 'short-answer') {
      updatedQuestions[index].options = undefined;
      updatedQuestions[index].correctAnswer = '';
    }
    
    setQuestions(updatedQuestions);
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updatedQuestions = [...questions];
    if (updatedQuestions[questionIndex].options) {
      const options = [...updatedQuestions[questionIndex].options!];
      options[optionIndex] = value;
      updatedQuestions[questionIndex] = { ...updatedQuestions[questionIndex], options };
      setQuestions(updatedQuestions);
    }
  };

  const moveQuestion = (questionId: string, direction: "up" | "down") => {
    setQuestions((prev) => {
      const currentIndex = prev.findIndex((question) => question.id === questionId);
      if (currentIndex < 0) return prev;
      const sectionId = prev[currentIndex].sectionId;
      const sectionIndices = prev
        .map((question, index) => (question.sectionId === sectionId ? index : -1))
        .filter((index) => index >= 0);
      const position = sectionIndices.indexOf(currentIndex);
      const targetIndex = direction === "up" ? sectionIndices[position - 1] : sectionIndices[position + 1];
      if (targetIndex === undefined) return prev;
      const updated = [...prev];
      [updated[currentIndex], updated[targetIndex]] = [updated[targetIndex], updated[currentIndex]];
      return updated;
    });
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const getQuestionsBySection = () => {
    const grouped: Record<string, Question[]> = {};
    questions.forEach((question) => {
      if (!grouped[question.sectionId]) {
        grouped[question.sectionId] = [];
      }
      grouped[question.sectionId].push(question);
    });
    return grouped;
  };

  const startPickerOptions = useMemo(() => {
    const base: Partial<FlatpickrOptions> = {
      enableTime: true,
      dateFormat: "Y-m-d\\TH:i",
      altInput: true,
      altFormat: "M j, Y h:i K",
      allowInput: false,
      disableMobile: true,
      altInputClass: DATE_TIME_ALT_INPUT_CLASS,
    };

    const maxDate = parsePickerBoundary(endDate);
    return maxDate ? { ...base, maxDate } : base;
  }, [endDate]);

  const endPickerOptions = useMemo(() => {
    const base: Partial<FlatpickrOptions> = {
      enableTime: true,
      dateFormat: "Y-m-d\\TH:i",
      altInput: true,
      altFormat: "M j, Y h:i K",
      allowInput: false,
      disableMobile: true,
      altInputClass: DATE_TIME_ALT_INPUT_CLASS,
    };

    const minDate = parsePickerBoundary(startDate);
    return minDate ? { ...base, minDate } : base;
  }, [startDate]);

  const startPickerValue = useMemo(() => {
    const parsedStartDate = parsePickerBoundary(startDate);
    return parsedStartDate ? [parsedStartDate] : [];
  }, [startDate]);

  const endPickerValue = useMemo(() => {
    const parsedEndDate = parsePickerBoundary(endDate);
    return parsedEndDate ? [parsedEndDate] : [];
  }, [endDate]);

  const handleStartDateChange = (selectedDates: Date[], dateStr: string) => {
    const nextStartDate = selectedDates[0]
      ? formatDateForPickerValue(selectedDates[0])
      : normalizePickerValue(dateStr);

    if (!nextStartDate) {
      return;
    }

    setStartDate(nextStartDate);

    if (isAutoSettingStartDateRef.current) {
      isAutoSettingStartDateRef.current = false;
      return;
    }

    if (isPublished) {
      setIsPublished(false);
    }
  };

  const handleEndDateChange = (selectedDates: Date[], dateStr: string) => {
    if (selectedDates[0]) {
      setEndDate(formatDateForPickerValue(selectedDates[0]));
      return;
    }

    setEndDate(normalizePickerValue(dateStr));
  };

  const handlePublishToggle = (checked: boolean) => {
    setIsPublished(checked);
    if (checked) {
      isAutoSettingStartDateRef.current = true;
      setStartDate(formatDateForPickerValue(new Date()));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const effectiveStartDate = isPublished ? formatDateForPickerValue(new Date()) : startDate;
    
    if (!title.trim() || questions.length === 0) {
      alert("Please fill in all required fields and add at least one question.");
      return;
    }

    const startTimestamp = Date.parse(effectiveStartDate);
    const endTimestamp = Date.parse(endDate);

    if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp)) {
      alert("Please provide valid start and end date/time.");
      return;
    }

    if (endTimestamp <= startTimestamp) {
      alert("End date/time must be later than start date/time.");
      return;
    }

    const sanitizedSections: Section[] = (sections.length ? sections : [createDefaultSection(1)]).map((section, index) => ({
      id: section.id || generateId(),
      title: section.title?.trim() || `Section ${index + 1}`,
      description: section.description?.trim() ?? "",
    }));

    const sectionLookup = new Map<string, Section>();
    sanitizedSections.forEach((section) => {
      sectionLookup.set(section.id, section);
    });

    const sanitizedQuestions: Question[] = questions.map((question, index) => {
      const fallbackSection = sanitizedSections[0];
      const resolvedSection = sectionLookup.get(question.sectionId) ?? fallbackSection;

      return {
        ...question,
        sectionId: resolvedSection.id,
        sectionTitle: resolvedSection.title,
      };
    });

    const quizData: QuizData = {
      title,
      description,
      startDate: effectiveStartDate,
      endDate,
      phonemicLevel: level,
      students,
      questions: sanitizedQuestions,
      sections: sanitizedSections,
      isPublished,
      quizCode: initialData?.quizCode || generateQuizCode(),
      qrToken: initialData?.qrToken || generateQrToken(),
    };

    onSave(quizData);
  };

  const getLevelLabel = () => (subject === "Math" ? "Math Level" : "Phonemic Level");

  const getModalTitle = () => (initialData ? "Edit Quiz" : "Create New Quiz");

  const getButtonText = () => (initialData ? "Update Quiz" : "Create Quiz");

  const questionsBySection = getQuestionsBySection();
  const formId = `add-quiz-form-${subject.toLowerCase()}`;

  const footer = (
    <>
      <SecondaryButton type="button" onClick={onClose}>
        Cancel
      </SecondaryButton>
      <PrimaryButton type="submit" form={formId}>
        {getButtonText()}
      </PrimaryButton>
    </>
  );

  return (
    <BaseModal
      show={open}
      onClose={onClose}
      title={getModalTitle()}
      footer={footer}
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-8">
        {/* Quiz Details Section */}
        <ModalSection title="Quiz Details">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-1">
              <ModalLabel required>Quiz Title</ModalLabel>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={FIELD_INPUT_CLASS}
                placeholder="Enter quiz title"
                required
              />
            </div>

            <div className="space-y-1">
              <ModalLabel>{getLevelLabel()}</ModalLabel>
              <input
                type="text"
                value={level}
                disabled
                className={READONLY_INPUT_CLASS}
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <ModalLabel>Description</ModalLabel>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={FIELD_TEXTAREA_CLASS}
                rows={3}
                placeholder="Enter quiz description"
              />
            </div>

            <div className="space-y-1">
              <ModalLabel required>Start Date</ModalLabel>
              <Flatpickr
                value={startPickerValue}
                options={startPickerOptions}
                onChange={handleStartDateChange}
                placeholder={isPublished ? "Set automatically when published" : "Select date and time"}
                className="flatpickr-hidden-input"
                required
              />
            </div>

            <div className="space-y-1">
              <ModalLabel required>End Date</ModalLabel>
              <Flatpickr
                value={endPickerValue}
                options={endPickerOptions}
                onChange={handleEndDateChange}
                placeholder="Select date and time"
                className="flatpickr-hidden-input"
                required
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(event) => handlePublishToggle(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#013300] focus:ring-[#013300]"
              />
              Publish quiz now
            </label>
          </div>
        </ModalSection>



        {/* Questions Section */}
        <ModalSection title="Questions & Answers">
          <div className="space-y-8">
            <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                Organize your quiz by section, then add questions under each section.
              </p>
              <button type="button" onClick={addSection} className={FLAT_ACTION_BUTTON_CLASS}>
                <Plus className="h-4 w-4" strokeWidth={2.25} />
                Add Section
              </button>
            </div>

            {sections.map((section, sectionIndex) => {
              const sectionQuestions = questionsBySection[section.id] ?? [];

              return (
                <div key={section.id} className="border-b border-gray-200 pb-8 last:border-b-0 last:pb-0">
                  <div className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <h4 className="text-base font-semibold text-gray-900">Section {sectionIndex + 1}</h4>
                      <p className="text-sm text-gray-500">{sectionQuestions.length} question{sectionQuestions.length === 1 ? "" : "s"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" onClick={() => addQuestionToSection(section.id)} className={FLAT_ACTION_BUTTON_CLASS}>
                        <Plus className="h-4 w-4" strokeWidth={2.25} />
                        Add Question
                      </button>
                      {sections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSection(section.id)}
                          className={DESTRUCTIVE_ACTION_CLASS}
                        >
                          Remove Section
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 pb-6 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="space-y-1">
                        <ModalLabel required>Section Title</ModalLabel>
                        <input
                          type="text"
                          value={section.title}
                          onChange={(event) => updateSection(section.id, "title", event.target.value)}
                          className={FIELD_INPUT_CLASS}
                          placeholder="Enter section title"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <ModalLabel>Section Description</ModalLabel>
                        <textarea
                          value={section.description ?? ""}
                          onChange={(event) => updateSection(section.id, "description", event.target.value)}
                          className={`${FIELD_TEXTAREA_CLASS} min-h-19`}
                          rows={2}
                          placeholder="Add context for this section"
                        />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {sectionQuestions.length === 0 ? (
                      <p className="rounded-md border border-dashed border-gray-300 px-4 py-5 text-sm text-gray-500">
                        No questions in this section yet. Click "Add Question" to begin.
                      </p>
                    ) : (
                      sectionQuestions.map((question, qIndex) => {
                        const globalIndex = questions.findIndex((q) => q.id === question.id);
                        return (
                          <div key={question.id} className="rounded-md border border-gray-200 bg-white px-4 py-4">
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <h5 className="text-sm font-semibold text-gray-900">Question {qIndex + 1}</h5>
                                <p className="text-xs uppercase tracking-[0.12em] text-gray-400">{question.type.replace("-", " ")}</p>
                              </div>
                              <div className="flex items-center gap-4">
                                <button
                                  type="button"
                                  onClick={() => moveQuestion(question.id, "up")}
                                  className={ICON_ACTION_BUTTON_CLASS}
                                  aria-label="Move question up"
                                  title="Move question up"
                                >
                                  <ChevronUp className="h-4 w-4" strokeWidth={2.25} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveQuestion(question.id, "down")}
                                  className={ICON_ACTION_BUTTON_CLASS}
                                  aria-label="Move question down"
                                  title="Move question down"
                                >
                                  <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeQuestion(globalIndex)}
                                  className={`${ICON_ACTION_BUTTON_CLASS} text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700`}
                                  aria-label="Remove question"
                                  title="Remove question"
                                >
                                  <Trash2 className="h-4 w-4" strokeWidth={2.25} />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div className="space-y-1 md:max-w-xs">
                                <ModalLabel>Question Type</ModalLabel>
                                <select
                                  value={question.type}
                                  onChange={(event) => updateQuestion(globalIndex, 'type', event.target.value)}
                                  className={FIELD_SELECT_CLASS}
                                >
                                  <option value="multiple-choice">Multiple Choice</option>
                                  <option value="true-false">True/False</option>
                                  <option value="short-answer">Short Answer</option>
                                </select>
                              </div>
                              <div className="space-y-1 md:max-w-35">
                                <ModalLabel required>Points</ModalLabel>
                                <input
                                  type="number"
                                  value={question.points}
                                  onChange={(event) => updateQuestion(globalIndex, 'points', Number(event.target.value))}
                                  className={FIELD_INPUT_CLASS}
                                  min="1"
                                  required
                                />
                              </div>
                              <div className="space-y-1 md:col-span-2">
                                <ModalLabel required>Question Text</ModalLabel>
                                <textarea
                                  value={question.question}
                                  onChange={(event) => updateQuestion(globalIndex, 'question', event.target.value)}
                                  className={FIELD_TEXTAREA_CLASS}
                                  rows={3}
                                  placeholder="Enter your question"
                                  required
                                />
                              </div>

                              {question.type === 'multiple-choice' && question.options && (
                                <div className="space-y-3 md:col-span-2">
                                  <ModalLabel required>Options & Correct Answer</ModalLabel>
                                  <div className="space-y-3">
                                    {question.options.map((option, oIndex) => (
                                      <label key={oIndex} className="flex items-center gap-3 rounded-md border border-gray-200 px-3 py-2">
                                        <input
                                          type="radio"
                                          name={`correct-${globalIndex}`}
                                          checked={question.correctAnswer === option}
                                          onChange={() => updateQuestion(globalIndex, 'correctAnswer', option)}
                                          className="h-4 w-4 border-gray-300 text-[#013300] focus:ring-[#013300]"
                                        />
                                        <span className="text-sm font-medium text-gray-500">{String.fromCharCode(65 + oIndex)}.</span>
                                        <input
                                          type="text"
                                          value={option}
                                          onChange={(event) => updateOption(globalIndex, oIndex, event.target.value)}
                                          className={`${FIELD_INPUT_CLASS} border-0 px-0 py-0 focus:ring-0`}
                                          placeholder={`Option ${oIndex + 1}`}
                                          required
                                        />
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {question.type === 'true-false' && question.options && (
                                <div className="space-y-2 md:col-span-2">
                                  <ModalLabel required>Select Correct Answer</ModalLabel>
                                  <div className="flex flex-wrap gap-6">
                                    {question.options.map((option, oIndex) => (
                                      <label key={oIndex} className="flex items-center gap-2 text-sm text-gray-700">
                                        <input
                                          type="radio"
                                          name={`correct-${globalIndex}`}
                                          checked={question.correctAnswer === option}
                                          onChange={() => updateQuestion(globalIndex, 'correctAnswer', option)}
                                          className="h-4 w-4 border-gray-300 text-[#013300] focus:ring-[#013300]"
                                        />
                                        <span>{option}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {question.type === 'short-answer' && (
                                <div className="space-y-1 md:col-span-2">
                                  <ModalLabel required>Correct Answer</ModalLabel>
                                  <input
                                    type="text"
                                    value={question.correctAnswer}
                                    onChange={(event) => updateQuestion(globalIndex, 'correctAnswer', event.target.value)}
                                    className={FIELD_INPUT_CLASS}
                                    placeholder="Enter correct answer"
                                    required
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {questions.length === 0 && (
            <div className="py-8 text-center text-gray-500">
              <p className="text-sm">
                No questions added yet. Use "Add Section" or "Add Question" to get started.
              </p>
            </div>
          )}
        </ModalSection>
      </form>
    </BaseModal>
  );
}