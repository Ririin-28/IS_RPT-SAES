"use client";

import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

interface DeleteConfirmationModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
  activityTitle?: string;
  activityDate?: string;
}

export default function DeleteConfirmationModal({ 
  show, 
  onClose, 
  onConfirm, 
  activityTitle, 
  activityDate 
}: DeleteConfirmationModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[95vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4 border-b pb-4">
            <SecondaryHeader title="Confirm Deletion" />
            <button 
              onClick={onClose} 
              className="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded-full hover:bg-gray-100"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div className="text-gray-700">
              <p className="mb-2">Are you sure you want to delete this activity?</p>
              {activityTitle && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="font-medium text-red-800">{activityTitle}</div>
                  {activityDate && (
                    <div className="text-sm text-red-600 mt-1">{activityDate}</div>
                  )}
                </div>
              )}
              <p className="text-sm text-red-600 mt-3 font-medium">
                This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t mt-6">
            <SecondaryButton 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5"
            >
              Cancel
            </SecondaryButton>
            <DangerButton 
              type="button" 
              onClick={onConfirm}
              className="px-5 py-2.5"
            >
              Delete Activity
            </DangerButton>
          </div>
        </div>
      </div>
    </div>
  );
}