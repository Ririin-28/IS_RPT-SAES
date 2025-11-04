"use client";

import BaseModal, { ModalLabel } from "@/components/Common/Modals/BaseModal";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

interface UpdateConfirmationModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  details?: string;
  confirmLabel?: string;
}

export default function UpdateConfirmationModal({
  show,
  onClose,
  onConfirm,
  title = "Confirm Update",
  details,
  confirmLabel = "Update",
}: UpdateConfirmationModalProps) {
  const footer = (
    <>
      <SecondaryButton type="button" onClick={onClose}>
        Cancel
      </SecondaryButton>
      <PrimaryButton type="button" onClick={onConfirm}>
        {confirmLabel}
      </PrimaryButton>
    </>
  );

  return (
    <BaseModal
      show={show}
      onClose={onClose}
      title={title}
      maxWidth="sm"
      footer={footer}
    >
      <div className="space-y-4">
        <ModalLabel>
          Do you want to proceed with this update?
        </ModalLabel>
        {details ? (
          <p className="text-sm text-gray-600">{details}</p>
        ) : (
          <p className="text-sm text-gray-600">
            Your changes will be applied immediately. Please review the information before confirming.
          </p>
        )}
      </div>
    </BaseModal>
  );
}
