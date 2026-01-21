import { useEffect, useMemo, useState } from "react";
import BaseModal, { ModalLabel, ModalSection } from "@/components/Common/Modals/BaseModal";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";

type MaybeString = string | null | undefined;

export const SUBJECT_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
export type SubjectWeekday = typeof SUBJECT_WEEKDAYS[number];
export type SubjectScheduleFormValues = Record<SubjectWeekday, string> & {
  startTime: string;
  endTime: string;
};

const buildEmptySchedule = (): SubjectScheduleFormValues =>
  SUBJECT_WEEKDAYS.reduce<SubjectScheduleFormValues>((acc, day) => {
    acc[day] = "";
    return acc;
  }, { startTime: "", endTime: "" } as SubjectScheduleFormValues);

const sanitizeInitialValues = (input: Record<SubjectWeekday, MaybeString> & { startTime?: MaybeString; endTime?: MaybeString } | null | undefined): SubjectScheduleFormValues => {
  const empty = buildEmptySchedule();
  if (!input) {
    return empty;
  }
  for (const day of SUBJECT_WEEKDAYS) {
    const raw = input[day];
    empty[day] = typeof raw === "string" ? raw.trim() : "";
  }
  empty.startTime = typeof input.startTime === "string" ? input.startTime.trim() : "";
  empty.endTime = typeof input.endTime === "string" ? input.endTime.trim() : "";
  return empty;
};

interface SubjectScheduleModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (values: SubjectScheduleFormValues) => void | Promise<void>;
  initialValues?: Record<SubjectWeekday, MaybeString> & { startTime?: MaybeString; endTime?: MaybeString } | null;
  subjectOptions: string[];
  isSaving?: boolean;
  errorMessage?: string | null;
}

export default function SubjectScheduleModal({
  show,
  onClose,
  onSave,
  initialValues,
  subjectOptions,
  isSaving = false,
  errorMessage,
}: SubjectScheduleModalProps) {
  const [values, setValues] = useState<SubjectScheduleFormValues>(() => buildEmptySchedule());
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!show) {
      return;
    }
    setValues(sanitizeInitialValues(initialValues ?? null));
    setValidationError(null);
  }, [show, initialValues]);

  const optionList = useMemo(() => {
    const unique = new Set<string>();
    for (const option of subjectOptions) {
      const trimmed = option?.trim();
      if (trimmed) {
        unique.add(trimmed);
      }
    }
    return Array.from(unique);
  }, [subjectOptions]);

  if (!show) {
    return null;
  }

  const handleChange = (day: SubjectWeekday, value: string) => {
    setValues((prev) => ({ ...prev, [day]: value }));
  };

  const handleTimeChange = (field: "startTime" | "endTime", value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const parseMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours * 60 + minutes;
  };

  const handleSubmit = () => {
    const hasExistingTime = Boolean(initialValues?.startTime || initialValues?.endTime);
    const normalizedInitial = sanitizeInitialValues(initialValues ?? null);
    const draftValues = sanitizeInitialValues(values);

    // Fix the validation logic:
    // 1. If NO existing times, both are required
    // 2. If HAS existing times, at least one must be provided (or keep existing)
    
    // First, determine what times we'll actually use
    let resolvedStart = draftValues.startTime || normalizedInitial.startTime;
    let resolvedEnd = draftValues.endTime || normalizedInitial.endTime;

    // If no existing schedule, require both
    if (!hasExistingTime) {
      if (!draftValues.startTime || !draftValues.endTime) {
        setValidationError("Select both start and end time before saving.");
        return;
      }
      // Use the draft values since we just verified they exist
      resolvedStart = draftValues.startTime;
      resolvedEnd = draftValues.endTime;
    } else {
      // Has existing schedule - check if user is trying to save
      // Check if BOTH draft values are empty AND we're not keeping existing
      if (!draftValues.startTime && !draftValues.endTime) {
        // Check if we have existing times to keep
        if (!normalizedInitial.startTime || !normalizedInitial.endTime) {
          // Existing schedule but one or both times might be missing
          setValidationError("Select at least a start or end time before saving.");
          return;
        }
        // Keep existing times
        resolvedStart = normalizedInitial.startTime;
        resolvedEnd = normalizedInitial.endTime;
      } else if (draftValues.startTime && !draftValues.endTime) {
        // User provided start but not end - keep existing end
        resolvedEnd = normalizedInitial.endTime;
        if (!resolvedEnd) {
          setValidationError("End time is required. Please provide an end time.");
          return;
        }
      } else if (!draftValues.startTime && draftValues.endTime) {
        // User provided end but not start - keep existing start
        resolvedStart = normalizedInitial.startTime;
        if (!resolvedStart) {
          setValidationError("Start time is required. Please provide a start time.");
          return;
        }
      } else {
        // User provided both - use them
        resolvedStart = draftValues.startTime;
        resolvedEnd = draftValues.endTime;
      }
    }

    // Now validate the times
    if (!resolvedStart || !resolvedEnd) {
      setValidationError("Both start and end time are required.");
      return;
    }

    const startMinutes = parseMinutes(resolvedStart);
    const endMinutes = parseMinutes(resolvedEnd);
    
    if (startMinutes === null || endMinutes === null) {
      setValidationError("Please enter a valid time range.");
      return;
    }
    
    if (endMinutes <= startMinutes) {
      setValidationError("End time must be later than the start time.");
      return;
    }

    // Validate subject assignments
    let hasAllSubjects = true;
    for (const day of SUBJECT_WEEKDAYS) {
      if (!values[day] || values[day].trim().length === 0) {
        hasAllSubjects = false;
        break;
      }
    }

    if (!hasAllSubjects) {
      setValidationError("Assign a subject for every weekday before saving.");
      return;
    }

    setValidationError(null);
    
    // Prepare payload with resolved times
    const payload: SubjectScheduleFormValues = {
      ...draftValues,
      startTime: resolvedStart,
      endTime: resolvedEnd,
    };
    
    void onSave(payload);
  };

  return (
    <BaseModal
      show={show}
      onClose={onClose}
      title="Configure Subject Schedule"
      maxWidth="lg"
      footer={(
        <>
          <SecondaryButton type="button" onClick={onClose} disabled={isSaving}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="button" onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </PrimaryButton>
        </>
      )}
    >
      <ModalSection title="Time Schedule">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <ModalLabel required>Start Time</ModalLabel>
            <input
              type="time"
              value={values.startTime}
              onChange={(event) => handleTimeChange("startTime", event.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#013300] focus:ring-offset-0 disabled:bg-gray-100"
              disabled={isSaving}
            />
          </div>
          <div className="space-y-1">
            <ModalLabel required>End Time</ModalLabel>
            <input
              type="time"
              value={values.endTime}
              onChange={(event) => handleTimeChange("endTime", event.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#013300] focus:ring-offset-0 disabled:bg-gray-100"
              disabled={isSaving}
            />
          </div>
        </div>
      </ModalSection>

      <ModalSection title="Weekday Assignments">
        <div className="grid gap-4 sm:grid-cols-2">
          {SUBJECT_WEEKDAYS.map((day) => (
            <div key={day} className="space-y-1">
              <ModalLabel required>{day}</ModalLabel>
              <select
                value={values[day] ?? ""}
                onChange={(event) => handleChange(day, event.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#013300] focus:ring-offset-0 disabled:bg-gray-100"
                disabled={isSaving}
              >
                <option value="">Select subject</option>
                {optionList.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        {validationError && <p className="mt-3 text-sm text-red-600">{validationError}</p>}
        {errorMessage && <p className="mt-1 text-sm text-red-600">{errorMessage}</p>}
      </ModalSection>
    </BaseModal>
  );
}
