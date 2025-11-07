"use client";

import BaseModal, { ModalLabel, ModalSection } from "@/components/Common/Modals/BaseModal";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import { useMemo } from "react";

interface RejectConfirmationModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
  reason: string;
  onReasonChange: (value: string) => void;
  isProcessing?: boolean;
  errorMessage?: string | null;
  materialTitle?: string;
}

export default function RejectConfirmationModal({
  show,
  onClose,
  onConfirm,
  reason,
  onReasonChange,
  isProcessing = false,
  errorMessage = null,
  materialTitle,
}: RejectConfirmationModalProps) {
  const footer = useMemo(() => (
    <>
      <SecondaryButton onClick={onClose} disabled={isProcessing}>
        Cancel
      </SecondaryButton>
      <DangerButton onClick={onConfirm} disabled={isProcessing}>
        {isProcessing ? "Processing..." : "Reject & Delete"}
      </DangerButton>
    </>
  ), [isProcessing, onClose, onConfirm]);

  return (
    <BaseModal show={show} onClose={onClose} title="Reject Material" footer={footer} maxWidth="md">
      <ModalSection title="Are you sure?">
        <p className="text-sm text-gray-700">
          Rejecting this material will permanently remove the uploaded files from the system. This action cannot be undone.
        </p>
        {materialTitle && (
          <p className="text-sm text-gray-500">
            Material: <span className="font-medium text-gray-700">{materialTitle}</span>
          </p>
        )}
        <div className="space-y-2">
          <ModalLabel required>Rejection Reason</ModalLabel>
          <textarea
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#013300] focus:ring-[#013300]"
            rows={4}
            placeholder="Provide a brief explanation for rejection"
          />
          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        </div>
      </ModalSection>
    </BaseModal>
  );
}
