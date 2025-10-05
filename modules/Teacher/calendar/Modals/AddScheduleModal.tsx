import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import { UseFormReturn } from "react-hook-form";

interface AddScheduleModalProps {
  show: boolean;
  onClose: () => void;
  form: UseFormReturn<any>;
  onSubmit: (data: any) => void;
}

export default function AddScheduleModal({ show, onClose, form, onSubmit }: AddScheduleModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;
  
  if (!show) return null;
  
  return (
    <div className="fixed inset-0 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[95vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4 border-b pb-4">
            <SecondaryHeader title="Add New Schedule" />
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors" aria-label="Close modal">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <TertiaryHeader title="Schedule Information" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Title*</label>
                  <input
                    className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                    placeholder="Enter schedule title"
                    {...register("title", { 
                      required: "Title is required"
                    })}
                  />
                  {errors.title && <span className="text-red-500 text-xs">{errors.title.message as string}</span>}
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Date*</label>
                  <input
                    type="date"
                    className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                    {...register("date", { required: "Date is required" })}
                  />
                  {errors.date && <span className="text-red-500 text-xs">{errors.date.message as string}</span>}
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Room No#*</label>
                  <input
                    className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                    placeholder="e.g., Room 101, Lab A"
                    {...register("roomNo", { 
                      required: "Room number is required"
                    })}
                  />
                  {errors.roomNo && <span className="text-red-500 text-xs">{errors.roomNo.message as string}</span>}
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm h-20 resize-none"
                    placeholder="Additional details about the schedule"
                    {...register("description")}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <DangerButton type="button" onClick={onClose} className="px-4 py-2">
                Cancel
              </DangerButton>
              <PrimaryButton type="submit" className="px-4 py-2">
                Save Schedule
              </PrimaryButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}