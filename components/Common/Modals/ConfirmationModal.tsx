"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PrimaryButton from "../Buttons/PrimaryButton";
import SecondaryButton from "../Buttons/SecondaryButton";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  fileName?: string;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  fileName,
}: ConfirmationModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isOpen) return undefined;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [mounted, isOpen]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="relative z-[10002] w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mb-4 text-gray-600">{message}</p>
        {fileName && (
          <p className="mb-6 rounded bg-gray-50 p-2 text-sm text-gray-500">
            File: {fileName}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={onConfirm}>Confirm</PrimaryButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
