"use client";

import React from "react";
import Toast, { ToastTone } from "@/components/Toast";

type ToastActivityProps = {
  title?: string;
  message: string;
  details?: React.ReactNode;
  tone?: ToastTone;
  actions?: React.ReactNode;
  expandable?: boolean;
  defaultExpanded?: boolean;
  onClose?: () => void;
  className?: string;
};

const ToastActivity: React.FC<ToastActivityProps> = ({ className = "", ...props }) => (
  <div className="fixed bottom-6 right-6 z-50 flex items-end justify-end pointer-events-none">
    <Toast
      {...props}
      className={`pointer-events-auto w-auto max-w-sm ${className}`}
    />
  </div>
);

export default ToastActivity;
