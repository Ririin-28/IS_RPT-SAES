import { UseFormReturn } from "react-hook-form";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import BaseModal, { ModalSection, ModalLabel } from "@/components/Common/Modals/BaseModal";

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

  if (!show) return null;

  const footer = (
    <>
      <SecondaryButton type="button" onClick={onClose}>
        Cancel
      </SecondaryButton>
      <PrimaryButton type="submit" form="add-schedule-form">
        Create Session
      </PrimaryButton>
    </>
  );

  return (
    <BaseModal
      show={show}
      onClose={onClose}
      title="Schedule Remediation Session"
      maxWidth="md"
      footer={footer}
    >
      <form id="add-schedule-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <ModalSection title="Session Details">
          <div className="space-y-4">
            <div className="space-y-1">
              <ModalLabel required>Session Title</ModalLabel>
              <input
                className={`w-full bg-white border ${errors.title ? "border-red-500" : "border-gray-300"} text-black rounded-md px-3 py-2 text-sm transition-all`}
                placeholder="Enter session title"
                {...register("title", {
                  required: "Title is required",
                })}
              />
              {errors.title && (
                <span className="text-red-500 text-xs mt-1">{errors.title.message as string}</span>
              )}
            </div>

            <div className="space-y-1">
              <ModalLabel required>Room</ModalLabel>
              <select
                className={`w-full bg-white border ${errors.roomNo ? "border-red-500" : "border-gray-300"} text-black rounded-md px-3 py-2 text-sm transition-all`}
                {...register("roomNo", {
                  required: "Room selection is required",
                })}
              >
                <option value="">Select a room</option>
                {ROOM_OPTIONS.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
              {errors.roomNo && (
                <span className="text-red-500 text-xs mt-1">{errors.roomNo.message as string}</span>
              )}
            </div>
          </div>
        </ModalSection>
      </form>
    </BaseModal>
  );
}