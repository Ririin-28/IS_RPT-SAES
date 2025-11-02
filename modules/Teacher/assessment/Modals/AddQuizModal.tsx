"use client";
import { useEffect, useMemo, useState } from "react";
import Flatpickr from "react-flatpickr";
import type { Options as FlatpickrOptions } from "flatpickr/dist/types/options";
import BaseModal, { ModalSection, ModalLabel } from "@/components/Common/Modals/BaseModal";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";

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

export default function AddQuizModal({ isOpen, show, onClose, onSave, initialData, level, subject }: AddQuizModalProps) {
  const open = isOpen ?? show ?? false;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sections, setSections] = useState<Section[]>(() => [createDefaultSection(1)]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [students, setStudents] = useState<Student[]>(MOCK_STUDENTS);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      setStartDate(normalizePickerValue(initialData.startDate ?? ""));
      setEndDate(normalizePickerValue(initialData.endDate ?? ""));
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
    } else if (field === 'type' && value === 'multiple-choice') {
      updatedQuestions[index].options = ['', '', '', ''];
    } else if (field === 'type' && value === 'short-answer') {
      updatedQuestions[index].options = undefined;
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
      allowInput: true,
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
      allowInput: true,
      disableMobile: true,
      altInputClass: DATE_TIME_ALT_INPUT_CLASS,
    };

    const minDate = parsePickerBoundary(startDate);
    return minDate ? { ...base, minDate } : base;
  }, [startDate]);

  const handleStartDateChange = (selectedDates: Date[], dateStr: string) => {
    if (selectedDates[0]) {
      setStartDate(formatDateForPickerValue(selectedDates[0]));
      return;
    }

    setStartDate(normalizePickerValue(dateStr));
  };

  const handleEndDateChange = (selectedDates: Date[], dateStr: string) => {
    if (selectedDates[0]) {
      setEndDate(formatDateForPickerValue(selectedDates[0]));
      return;
    }

    setEndDate(normalizePickerValue(dateStr));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !startDate || !endDate || questions.length === 0) {
      alert("Please fill in all required fields and add at least one question.");
      return;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      alert("End date must be after start date.");
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
      startDate,
      endDate,
      phonemicLevel: level,
      students,
      questions: sanitizedQuestions,
      sections: sanitizedSections,
      isPublished: initialData?.isPublished ?? false
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
      <form id={formId} onSubmit={handleSubmit} className="space-y-6">
        {/* Quiz Details Section */}
        <ModalSection title="Quiz Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <ModalLabel required>Quiz Title</ModalLabel>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
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
                className="w-full bg-gray-50 border border-gray-300 text-gray-600 rounded-md px-3 py-2 text-sm"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <ModalLabel>Description</ModalLabel>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                rows={3}
                placeholder="Enter quiz description"
              />
            </div>

            <div className="space-y-1">
              <ModalLabel required>Start Date</ModalLabel>
              <Flatpickr
                value={startDate}
                options={startPickerOptions}
                onChange={handleStartDateChange}
                onValueUpdate={handleStartDateChange}
                placeholder="Select date and time"
                className="flatpickr-hidden-input"
                required
              />
            </div>

            <div className="space-y-1">
              <ModalLabel required>End Date</ModalLabel>
              <Flatpickr
                value={endDate}
                options={endPickerOptions}
                onChange={handleEndDateChange}
                onValueUpdate={handleEndDateChange}
                placeholder="Select date and time"
                className="flatpickr-hidden-input"
                required
              />
            </div>
          </div>
        </ModalSection>



        {/* Questions Section */}
        <ModalSection title="Questions & Answers">
          <div className="space-y-6">
            {sections.map((section, sectionIndex) => {
              const sectionQuestions = questionsBySection[section.id] ?? [];

              return (
                <div key={section.id} className="rounded-lg border border-gray-200 bg-white">
                  <div className="flex flex-col gap-4 border-b border-gray-200 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="space-y-1">
                        <ModalLabel required>Section {sectionIndex + 1} Title</ModalLabel>
                        <input
                          type="text"
                          value={section.title}
                          onChange={(event) => updateSection(section.id, "title", event.target.value)}
                          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#013300]"
                          placeholder="Enter section title"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <ModalLabel>Section Description (optional)</ModalLabel>
                        <textarea
                          value={section.description ?? ""}
                          onChange={(event) => updateSection(section.id, "description", event.target.value)}
                          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#013300]"
                          rows={2}
                          placeholder="Add context for this section"
                        />
                      </div>
                    </div>
                    <div className="flex flex-row gap-2 sm:flex-col sm:items-end">
                      <UtilityButton type="button" onClick={() => addQuestionToSection(section.id)} small>
                        Add Question
                      </UtilityButton>
                      {sections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSection(section.id)}
                          className="text-sm font-medium text-red-600 hover:text-red-800"
                        >
                          Remove Section
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    {sectionQuestions.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No questions in this section yet. Click "Add Question" to begin.
                      </p>
                    ) : (
                      sectionQuestions.map((question, qIndex) => {
                        const globalIndex = questions.findIndex((q) => q.id === question.id);
                        return (
                          <div key={question.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                            <div className="mb-4 flex items-start justify-between">
                              <h5 className="font-medium text-gray-700">Question {qIndex + 1}</h5>
                              <button
                                type="button"
                                onClick={() => removeQuestion(globalIndex)}
                                className="text-sm font-medium text-red-600 hover:text-red-800"
                              >
                                Remove
                              </button>
                            </div>

                            <div className="space-y-4">
                              {/* Question Type */}
                              <div className="space-y-1">
                                <ModalLabel>Question Type</ModalLabel>
                                <select
                                  value={question.type}
                                  onChange={(event) => updateQuestion(globalIndex, 'type', event.target.value)}
                                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                                >
                                  <option value="multiple-choice">Multiple Choice</option>
                                  <option value="true-false">True/False</option>
                                  <option value="short-answer">Short Answer</option>
                                </select>
                              </div>

                              {/* Question Text */}
                              <div className="space-y-1">
                                <ModalLabel required>Question Text</ModalLabel>
                                <textarea
                                  value={question.question}
                                  onChange={(event) => updateQuestion(globalIndex, 'question', event.target.value)}
                                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                                  rows={3}
                                  placeholder="Enter your question"
                                  required
                                />
                              </div>

                              {/* Options for Multiple Choice */}
                              {question.type === 'multiple-choice' && question.options && (
                                <div className="space-y-1">
                                  <ModalLabel required>Options & Correct Answer</ModalLabel>
                                  <div className="space-y-2">
                                    {question.options.map((option, oIndex) => (
                                      <div key={oIndex} className="flex items-center gap-3">
                                        <input
                                          type="radio"
                                          name={`correct-${globalIndex}`}
                                          checked={question.correctAnswer === option}
                                          onChange={() => updateQuestion(globalIndex, 'correctAnswer', option)}
                                          className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <input
                                          type="text"
                                          value={option}
                                          onChange={(event) => updateOption(globalIndex, oIndex, event.target.value)}
                                          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                                          placeholder={`Option ${oIndex + 1}`}
                                          required
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Options for True/False */}
                              {question.type === 'true-false' && question.options && (
                                <div className="space-y-1">
                                  <ModalLabel required>Select Correct Answer</ModalLabel>
                                  <div className="flex gap-4">
                                    {question.options.map((option, oIndex) => (
                                      <label key={oIndex} className="flex items-center gap-2">
                                        <input
                                          type="radio"
                                          name={`correct-${globalIndex}`}
                                          checked={question.correctAnswer === option}
                                          onChange={() => updateQuestion(globalIndex, 'correctAnswer', option)}
                                          className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">{option}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Correct Answer for Short Answer */}
                              {question.type === 'short-answer' && (
                                <div className="space-y-1">
                                  <ModalLabel required>Correct Answer</ModalLabel>
                                  <input
                                    type="text"
                                    value={question.correctAnswer}
                                    onChange={(event) => updateQuestion(globalIndex, 'correctAnswer', event.target.value)}
                                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                                    placeholder="Enter correct answer"
                                    required
                                  />
                                </div>
                              )}

                              {/* Points */}
                              <div className="space-y-1">
                                <ModalLabel required>Points</ModalLabel>
                                <input
                                  type="number"
                                  value={question.points}
                                  onChange={(event) => updateQuestion(globalIndex, 'points', Number(event.target.value))}
                                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                                  min="1"
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end">
              <UtilityButton type="button" onClick={addSection} small>
                + Add Section
              </UtilityButton>
            </div>
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