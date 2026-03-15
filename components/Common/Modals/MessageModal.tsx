"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PrimaryButton from "../Buttons/PrimaryButton";

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  actionLabel?: string;
}

export default function MessageModal({
  isOpen,
  onClose,
  title,
  message,
  actionLabel = "OK",
}: MessageModalProps) {
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
    <div className="fixed inset-0 z-10001 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" aria-hidden="true" onClick={onClose} />
      <div className="relative z-10002 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mb-6 text-gray-600">{message}</p>
        <div className="flex justify-end">
          <PrimaryButton onClick={onClose}>{actionLabel}</PrimaryButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
