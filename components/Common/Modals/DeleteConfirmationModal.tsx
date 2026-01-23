import React from "react";
import DangerButton from "../Buttons/DangerButton";
import SecondaryButton from "../Buttons/SecondaryButton";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  itemName?: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  isProcessing?: boolean;
  errorMessage?: string | null;
  showCancel?: boolean;
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Delete",
  message = "Are you sure you want to delete this item? This action cannot be undone.",
  itemName,
  confirmLabel = "Delete",
  confirmDisabled = false,
  isProcessing = false,
  errorMessage = null,
  showCancel = true,
}: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <p className="text-gray-600 mb-4">{message}</p>
        {errorMessage && (
          <p className="text-sm text-red-600 mb-4" role="alert">{errorMessage}</p>
        )}
        {itemName && <p className="text-sm text-gray-700 mb-4">Item: <strong>{itemName}</strong></p>}
        <div className="flex gap-3 justify-end">
          {showCancel && <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>}
          <DangerButton onClick={onConfirm} disabled={confirmDisabled || isProcessing}>
            {isProcessing ? "Processing..." : confirmLabel}
          </DangerButton>
        </div>
      </div>
    </div>
  );
}
