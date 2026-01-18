"use client";

import BaseModal, { ModalSection } from "./BaseModal";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

interface AccountArchivedModalProps {
  show: boolean;
  onClose: () => void;
  roleLabel: string;
  count: number;
}

export default function AccountArchivedModal({ show, onClose, roleLabel, count }: AccountArchivedModalProps) {
  if (!show) return null;

  const title = count === 1
    ? `${roleLabel} Archived Successfully`
    : `${count} ${roleLabel}${count === 1 ? "" : "s"} Archived Successfully`;

  return (
    <BaseModal
      show={show}
      onClose={onClose}
      title={title}
      footer={<SecondaryButton onClick={onClose}>Close</SecondaryButton>}
    >
      <ModalSection title="Archive Completed">
        <p className="text-sm text-gray-600">
          {count} {roleLabel}{count === 1 ? "" : "s"} moved to archive.
        </p>
      </ModalSection>
    </BaseModal>
  );
}
