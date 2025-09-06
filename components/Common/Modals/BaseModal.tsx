import React from "react";

interface BaseModalProps {
  show: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  footer?: React.ReactNode;
}

export default function BaseModal({ 
  show, 
  onClose, 
  title, 
  children, 
  maxWidth = "2xl",
  footer 
}: BaseModalProps) {
  if (!show) return null;

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md", 
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl"
  };

  return (
    <div className="fixed inset-0 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className={`bg-white rounded-lg shadow-xl w-full ${maxWidthClasses[maxWidth]} max-h-[95vh] overflow-y-auto`}>
        <div className="p-6">
          {/* Modal Header */}
          <div className="flex justify-between items-center mb-4 border-b pb-4">
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Modal Content */}
          <div className="space-y-6">
            {children}
          </div>

          {/* Modal Footer */}
          {footer && (
            <div className="flex justify-end gap-3 pt-4 border-t mt-6">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Text Components for consistent styling
export function ModalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      {children}
    </div>
  );
}

export function ModalLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

export function ModalInfoItem({ label, value }: { label: string; value: any }) {
  return (
    <div className="space-y-1">
      <ModalLabel>{label}</ModalLabel>
      <div className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-md px-3 py-2 text-sm">
        {value || "-"}
      </div>
    </div>
  );
}