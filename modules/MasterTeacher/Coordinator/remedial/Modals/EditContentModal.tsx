"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
import BaseModal, { ModalLabel, ModalSection } from "@/components/Common/Modals/BaseModal";

export interface FlashcardContent {
  sentence: string;
  highlights: string[];
  answer?: string;
}

interface EditContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  flashcards: FlashcardContent[];
  onSave: (flashcards: FlashcardContent[]) => void;
  subject?: string;
}

export default function EditContentModal({ isOpen, onClose, flashcards, onSave, subject }: EditContentModalProps) {
  const [editableFlashcards, setEditableFlashcards] = useState<FlashcardContent[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDiscardChangesModal, setShowDiscardChangesModal] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isMathSubject = subject === "Math";
  const usesAnswerField = isMathSubject || editableFlashcards.some((card) => card.answer !== undefined);
  const sentenceLabel = isMathSubject ? "Math Problem" : "Sentence";
  const answerLabel = isMathSubject ? "Correct Answer" : "Answer";
  const sentencePlaceholder = isMathSubject
    ? "Enter the math problem for this flashcard..."
    : "Enter the sentence for this flashcard...";
  const answerPlaceholder = isMathSubject
    ? "Enter the correct answer..."
    : "Enter the answer...";
  const description = isMathSubject
    ? "Review each math problem and answer before saving the updated flashcard set."
    : "Review and refine each sentence before saving the updated flashcard set.";
  const fieldInputClass =
    "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#013300] focus:ring-1 focus:ring-[#013300]";
  const fieldTextareaClass = `${fieldInputClass} min-h-[88px] resize-y`;
  const iconActionButtonClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40";
  const validationAlertClass =
    "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700";

  useEffect(() => {
    if (isOpen) {
      const normalized = (flashcards ?? []).map((card) => {
        if (!isMathSubject) return card;
        return {
          ...card,
          answer: card.answer ?? "",
        };
      });
      setEditableFlashcards([...normalized]);
      setHasChanges(false);
      setShowDiscardChangesModal(false);
      setValidationError(null);
    } else {
      setShowDiscardChangesModal(false);
      setValidationError(null);
    }
  }, [isOpen, flashcards, isMathSubject]);

  const closeEditor = () => {
    setHasChanges(false);
    setShowDiscardChangesModal(false);
    setValidationError(null);
    onClose();
  };

  const handleSentenceChange = (index: number, value: string) => {
    const updated = [...editableFlashcards];
    updated[index] = { ...updated[index], sentence: value };
    setEditableFlashcards(updated);
    setHasChanges(true);
    setValidationError(null);
  };

  const handleAnswerChange = (index: number, value: string) => {
    const updated = [...editableFlashcards];
    updated[index] = { ...updated[index], answer: value };
    setEditableFlashcards(updated);
    setHasChanges(true);
    setValidationError(null);
  };

  const addNewFlashcard = () => {
    const newCard: FlashcardContent = usesAnswerField
      ? { sentence: "", highlights: [], answer: "" }
      : { sentence: "", highlights: [] };
    setEditableFlashcards([
      ...editableFlashcards,
      newCard,
    ]);
    setHasChanges(true);
    setValidationError(null);
  };

  const removeFlashcard = (index: number) => {
    if (editableFlashcards.length <= 1) {
      setValidationError("At least one flashcard is required.");
      return;
    }
    const updated = editableFlashcards.filter((_, i) => i !== index);
    setEditableFlashcards(updated);
    setHasChanges(true);
    setValidationError(null);
  };

  const handleSave = () => {
    const emptySentences = editableFlashcards.filter((card) => !card.sentence.trim());
    if (emptySentences.length > 0) {
      setValidationError(
        isMathSubject
          ? "Please fill in all math problems before saving."
          : "Please fill in all sentences before saving.",
      );
      return;
    }

    const emptyAnswers = editableFlashcards.filter((card) => {
      if (isMathSubject) return !String(card.answer ?? "").trim();
      return card.answer !== undefined && !card.answer.trim();
    });

    if (emptyAnswers.length > 0) {
      setValidationError("Please fill in all answers before saving.");
      return;
    }
    setValidationError(null);
    onSave(editableFlashcards);
    closeEditor();
  };

  const handleCloseRequest = () => {
    if (hasChanges) {
      setShowDiscardChangesModal(true);
      return;
    }
    closeEditor();
  };

  const footer = (
    <>
      <SecondaryButton type="button" onClick={handleCloseRequest}>
        Cancel
      </SecondaryButton>
      <PrimaryButton type="button" onClick={handleSave} disabled={!hasChanges}>
        Save Changes
      </PrimaryButton>
    </>
  );

  return (
    <>
      <BaseModal
        show={isOpen}
        onClose={handleCloseRequest}
        title="Edit Flashcards Content"
        maxWidth="3xl"
        footer={footer}
      >
        <ModalSection title="Flashcards">
          <div className="space-y-5">
            <div className="border-b border-gray-200 pb-4">
              <p className="text-sm text-gray-500">{description}</p>
            </div>

            {validationError && (
              <div className={validationAlertClass}>
                {validationError}
              </div>
            )}

            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <div className="space-y-4">
                {editableFlashcards.map((card: FlashcardContent, index: number) => (
                  <section key={index} className="rounded-md border border-gray-200 bg-white px-4 py-4">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">Flashcard {index + 1}</h3>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFlashcard(index)}
                        disabled={editableFlashcards.length <= 1}
                        className={iconActionButtonClass}
                        aria-label={`Remove flashcard ${index + 1}`}
                        title={`Remove flashcard ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2.25} />
                      </button>
                    </div>

                    <div className={`grid grid-cols-1 gap-4 ${usesAnswerField ? "md:grid-cols-[minmax(0,1fr)_240px]" : ""}`}>
                      <div className="space-y-1">
                        <ModalLabel required>{sentenceLabel}</ModalLabel>
                        <textarea
                          value={card.sentence}
                          onChange={(event) => handleSentenceChange(index, event.target.value)}
                          placeholder={sentencePlaceholder}
                          className={fieldTextareaClass}
                          rows={3}
                        />
                      </div>

                      {usesAnswerField && (
                        <div className="space-y-1">
                          <ModalLabel required>{answerLabel}</ModalLabel>
                          <input
                            value={card.answer ?? ""}
                            onChange={(event) => handleAnswerChange(index, event.target.value)}
                            placeholder={answerPlaceholder}
                            className={fieldInputClass}
                          />
                          <p className="text-xs leading-5 text-gray-500">
                            {isMathSubject
                              ? "Use the final correct answer shown to the student."
                              : "Use a short, exact answer for this flashcard."}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={addNewFlashcard}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm font-semibold text-[#013300] transition hover:border-[#013300]/35 hover:bg-[#013300]/5"
            >
              <span className="text-base leading-none">+</span>
              Add Flashcard
            </button>
          </div>
        </ModalSection>
      </BaseModal>

      <ConfirmationModal
        isOpen={showDiscardChangesModal}
        onClose={() => setShowDiscardChangesModal(false)}
        onConfirm={closeEditor}
        title="Discard Unsaved Changes?"
        message="You have unsaved flashcard changes. Are you sure you want to close this editor without saving?"
      />
    </>
  );
}
