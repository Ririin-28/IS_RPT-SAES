"use client";
import { useEffect, useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import BaseModal, { ModalSection } from "@/components/Common/Modals/BaseModal";

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
}

export default function EditContentModal({ isOpen, onClose, flashcards, onSave }: EditContentModalProps) {
  const [editableFlashcards, setEditableFlashcards] = useState<FlashcardContent[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const usesAnswerField = editableFlashcards.some((card) => card.answer !== undefined);

  useEffect(() => {
    if (isOpen) {
      setEditableFlashcards([...flashcards]);
      setHasChanges(false);
    }
  }, [isOpen, flashcards]);

  const handleSentenceChange = (index: number, value: string) => {
    const updated = [...editableFlashcards];
    updated[index] = { ...updated[index], sentence: value };
    setEditableFlashcards(updated);
    setHasChanges(true);
  };

  const handleAnswerChange = (index: number, value: string) => {
    const updated = [...editableFlashcards];
    updated[index] = { ...updated[index], answer: value };
    setEditableFlashcards(updated);
    setHasChanges(true);
  };

  const addNewFlashcard = () => {
    const newCard: FlashcardContent = usesAnswerField
      ? { sentence: "", highlights: [], answer: "" }
      : { sentence: "", highlights: [] };
    setEditableFlashcards([
      ...editableFlashcards,
      newCard
    ]);
    setHasChanges(true);
  };

  const removeFlashcard = (index: number) => {
    if (editableFlashcards.length <= 1) {
      alert("You must have at least one flashcard.");
      return;
    }

    const updated = editableFlashcards.filter((_, i) => i !== index);
    setEditableFlashcards(updated);
    setHasChanges(true);
  };

  const handleSave = () => {
    // Validate that all sentences are filled
    const emptySentences = editableFlashcards.filter(card => !card.sentence.trim());
    if (emptySentences.length > 0) {
      alert("Please fill in all sentences before saving.");
      return;
    }

    const emptyAnswers = editableFlashcards.filter(
      (card) => card.answer !== undefined && !card.answer.trim(),
    );
    if (emptyAnswers.length > 0) {
      alert("Please fill in all answers before saving.");
      return;
    }

    onSave(editableFlashcards);
    onClose();
  };

  const handleClose = () => {
    if (hasChanges) {
      const confirmClose = window.confirm("You have unsaved changes. Are you sure you want to close?");
      if (!confirmClose) return;
    }
    onClose();
  };

  const footer = (
    <>
      <SecondaryButton
        onClick={handleClose}
      >
        Cancel
      </SecondaryButton>
      <UtilityButton
        onClick={handleSave}
        disabled={!hasChanges}
        className="bg-[#013300] hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Save Changes
      </UtilityButton>
    </>
  );

  return (
    <BaseModal
      show={isOpen}
      onClose={handleClose}
      title="Edit Flashcards Content"
      maxWidth="3xl"
      footer={footer}
    >
      <ModalSection title="Flashcards">
        <p className="text-sm text-gray-600 mb-4">
          Update each sentence below. These changes apply to the Master Teacher flashcard session.
        </p>
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
          {editableFlashcards.map((card: FlashcardContent, index: number) => (
            <div key={index} className="border border-gray-300 rounded-xl p-6 bg-gray-50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Flashcard {index + 1}</h3>
                <button
                  onClick={() => removeFlashcard(index)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                  disabled={editableFlashcards.length <= 1}
                >
                  Remove
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sentence *</label>
                  <textarea
                    value={card.sentence}
                    onChange={(event) => handleSentenceChange(index, event.target.value)}
                    placeholder="Enter the sentence for this flashcard..."
                    className="w-full h-24 rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  />
                </div>
                {card.answer !== undefined && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Answer *</label>
                    <input
                      value={card.answer}
                      onChange={(event) => handleAnswerChange(index, event.target.value)}
                      placeholder="Enter the correct answer..."
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <UtilityButton
            onClick={addNewFlashcard}
            className="bg-[#013300] hover:bg-green-900 w-full justify-center"
          >
            + Add New Flashcard
          </UtilityButton>
        </div>
      </ModalSection>
    </BaseModal>
  );
}