"use client";

import DeleteConfirmationModal from "./DeleteConfirmationModal";

interface AccountDeletedModalProps {
  show: boolean;
  onClose: () => void;
  roleLabel: string;
  count: number;
}

export default function AccountDeletedModal({ show, onClose, roleLabel, count }: AccountDeletedModalProps) {
  const title = count === 1
    ? `${roleLabel} Deleted Successfully`
    : `${count} ${roleLabel}${count === 1 ? "" : "s"} Deleted Successfully`;

  return (
    <DeleteConfirmationModal
      isOpen={show}
      onClose={onClose}
      onConfirm={onClose}
      title={title}
      message={`${count} ${roleLabel}${count === 1 ? "" : "s"} permanently deleted.`}
      confirmLabel="Close"
      showCancel={false}
    />
  );
}
