import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import { UseFormReturn } from "react-hook-form";
import { useState } from "react";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

interface AddScheduleModalProps {
  show: boolean;
  onClose: () => void;
  form: UseFormReturn<any>;
  onSubmit: (data: any) => void;
  selectedDate?: Date | null;
}

// Sample data for rooms and teachers
const ROOM_OPTIONS = [
  { id: "room-101", name: "Room 101" },
  { id: "room-102", name: "Room 102" },
  { id: "room-103", name: "Room 103" },
  { id: "room-201", name: "Room 201" },
  { id: "room-202", name: "Room 202" },
];

const TEACHER_OPTIONS = [
  { id: "teacher-1", name: "Sarah Johnson" },
  { id: "teacher-2", name: "Michael Chen" },
  { id: "teacher-3", name: "Emily Williams" },
  { id: "teacher-4", name: "David Rodriguez" },
  { id: "teacher-5", name: "Lisa Thompson" },
  { id: "teacher-6", name: "James Wilson" },
  { id: "teacher-7", name: "Amanda Lee" },
  { id: "teacher-8", name: "Robert Brown" },
];

export default function AddScheduleModal({ show, onClose, form, onSubmit, selectedDate }: AddScheduleModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = form;

  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  
  // Watch the teachers field to sync with our state
  const teachersValue = watch("teachers") || [];
  
  if (!show) return null;

  const handleTeacherSelection = (teacherId: string) => {
    const newSelection = selectedTeachers.includes(teacherId)
      ? selectedTeachers.filter(id => id !== teacherId)
      : [...selectedTeachers, teacherId];
    
    setSelectedTeachers(newSelection);
    setValue("teachers", newSelection);
  };

  const handleSelectAllTeachers = () => {
    if (selectedTeachers.length === TEACHER_OPTIONS.length) {
      setSelectedTeachers([]);
      setValue("teachers", []);
    } else {
      const allTeacherIds = TEACHER_OPTIONS.map(teacher => teacher.id);
      setSelectedTeachers(allTeacherIds);
      setValue("teachers", allTeacherIds);
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[95vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <SecondaryHeader title="Schedule Remediation Session" />
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
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Session Title*</label>
                <input
                  className={`w-full bg-white border ${errors.title ? 'border-red-500' : 'border-gray-300'} border border-gray-300 text-black rounded-md px-3 py-2 text-sm transition-all`}
                  placeholder="Enter session title"
                  {...register("title", { 
                    required: "Title is required"
                  })}
                />
                {errors.title && <span className="text-red-500 text-xs mt-1">{errors.title.message as string}</span>}
              </div>
              
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Room*</label>
                <select
                  className={`w-full bg-white border ${errors.roomNo ? 'border-red-500' : 'border-gray-300'} border border-gray-300 text-black rounded-md px-3 py-2 text-sm transition-all`}
                  {...register("roomNo", { 
                    required: "Room selection is required"
                  })}
                >
                  <option value="">Select a room</option>
                  {ROOM_OPTIONS.map(room => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
                {errors.roomNo && <span className="text-red-500 text-xs mt-1">{errors.roomNo.message as string}</span>}
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">Teachers in Charge*</label>
                  <button
                    type="button"
                    onClick={handleSelectAllTeachers}
                    className="text-xs"
                  >
                    {selectedTeachers.length === TEACHER_OPTIONS.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                
                <div className={`border ${errors.teachers ? 'border-red-500' : 'border-gray-300'} rounded-lg p-2 max-h-40 overflow-y-auto`}>
                  {TEACHER_OPTIONS.map(teacher => (
                    <div key={teacher.id} className="flex items-center p-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        id={teacher.id}
                        checked={selectedTeachers.includes(teacher.id)}
                        onChange={() => handleTeacherSelection(teacher.id)}
                        className="h-4 w-4 "
                      />
                      <label htmlFor={teacher.id} className="ml-2 text-sm text-gray-700 cursor-pointer">
                        <span className="font-medium">{teacher.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
                {errors.teachers && <span className="text-red-500 text-xs mt-1">{errors.teachers.message as string}</span>}
                <input type="hidden" {...register("teachers", { required: "At least one teacher must be selected" })} />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t">
              <SecondaryButton type="button" onClick={onClose} className="px-5 py-2.5">
                Cancel
              </SecondaryButton>
              <PrimaryButton type="submit" className="px-5 py-2.5">
                Create Session
              </PrimaryButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}