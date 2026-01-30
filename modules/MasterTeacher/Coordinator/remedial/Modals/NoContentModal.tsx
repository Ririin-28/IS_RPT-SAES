"use client";

import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";

type NoContentModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function NoContentModal({ isOpen, onClose }: NoContentModalProps) {
  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onClose}
      title="No Content Available"
      message="No approved flashcards content has been found for this activity."
    />
  );
}
