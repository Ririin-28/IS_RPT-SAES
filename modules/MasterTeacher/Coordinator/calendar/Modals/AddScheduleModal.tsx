import { UseFormReturn } from "react-hook-form";
import { useEffect } from "react";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import BaseModal, { ModalSection, ModalLabel, ModalInfoItem } from "@/components/Common/Modals/BaseModal";

interface AddScheduleModalProps {
  show: boolean;
  onClose: () => void;
  form: UseFormReturn<any>;
  onSubmit: (data: any) => void;
  selectedDate?: Date | null;
  gradeLabel: string;
  allowedSubjects: string[];
  canSchedule: boolean;
  scheduleWindowLabel?: string | null;
  scheduleStartDate?: string | null;
  scheduleEndDate?: string | null;
}

export default function AddScheduleModal({
  show,
  onClose,
  form,
  onSubmit,
  selectedDate,
  gradeLabel,
  allowedSubjects,
  canSchedule,
  scheduleWindowLabel,
  scheduleStartDate,
  scheduleEndDate,
}: AddScheduleModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = form;

  useEffect(() => {
    if (!show) {
      return;
    }
    if (selectedDate) {
      setValue("date", selectedDate.toLocaleDateString("en-CA"), {
        shouldValidate: false,
        shouldDirty: false,
      });
    } else {
      setValue("date", "", {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }, [selectedDate, setValue, show]);

  if (!show) return null;

  const selectedDateLabel = selectedDate
    ? selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const hasSubjects = allowedSubjects.length > 0;
  const subjectLocked = allowedSubjects.length <= 1;

  const footer = (
    <>
      <SecondaryButton type="button" onClick={onClose}>
        Cancel
      </SecondaryButton>
      <PrimaryButton
        type="submit"
        form="add-schedule-form"
        disabled={!canSchedule || !hasSubjects}
        title={!canSchedule || !hasSubjects ? "Scheduling is disabled until your assignment is set" : undefined}
      >
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
        <input type="hidden" {...register("date")} />
        <ModalSection title="Assigned Scope">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <ModalInfoItem label="Grade Level" value={gradeLabel} />
              <div className="space-y-1">
                <ModalLabel required>Subject</ModalLabel>
                {subjectLocked ? (
                  <>
                    <div className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700">
                      {allowedSubjects[0] ?? "Not assigned"}
                    </div>
                    <input
                      type="hidden"
                      value={allowedSubjects[0] ?? ""}
                      {...register("subject", {
                        required: "Subject is required",
                      })}
                    />
                  </>
                ) : (
                  <select
                    className={`w-full bg-white border ${errors.subject ? "border-red-500" : "border-gray-300"} text-black rounded-md px-3 py-2 text-sm transition-all`}
                    {...register("subject", {
                      required: "Subject is required",
                    })}
                  >
                    {allowedSubjects.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                )}
                {!hasSubjects && (
                  <p className="text-xs text-amber-600">Subject assignment is required before you can schedule activities.</p>
                )}
                {errors.subject && (
                  <span className="text-red-500 text-xs mt-1">{errors.subject.message as string}</span>
                )}
              </div>
            </div>
            {selectedDateLabel && <ModalInfoItem label="Session Date" value={selectedDateLabel} />}
            {scheduleWindowLabel && <ModalInfoItem label="Remedial Window" value={scheduleWindowLabel} />}
          </div>
        </ModalSection>

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
          </div>
        </ModalSection>

        {!canSchedule && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Scheduling is currently disabled. Please confirm that your grade, subject assignments, and the principal's remedial window are all active.
          </div>
        )}
      </form>
    </BaseModal>
  );
}