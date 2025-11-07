import { useEffect, useMemo, useState } from "react";
import BaseModal, { ModalLabel, ModalSection } from "@/components/Common/Modals/BaseModal";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";

type MaybeString = string | null | undefined;

export const SUBJECT_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
export type SubjectWeekday = typeof SUBJECT_WEEKDAYS[number];
export type SubjectScheduleFormValues = Record<SubjectWeekday, string>;

const buildEmptySchedule = (): SubjectScheduleFormValues =>
  SUBJECT_WEEKDAYS.reduce<SubjectScheduleFormValues>((acc, day) => {
    acc[day] = "";
    return acc;
  }, {} as SubjectScheduleFormValues);

const sanitizeInitialValues = (input: Record<SubjectWeekday, MaybeString> | null | undefined): SubjectScheduleFormValues => {
  const empty = buildEmptySchedule();
  if (!input) {
    return empty;
  }
  for (const day of SUBJECT_WEEKDAYS) {
    const raw = input[day];
    empty[day] = typeof raw === "string" ? raw.trim() : "";
  }
  return empty;
};

interface SubjectScheduleModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (values: SubjectScheduleFormValues) => void | Promise<void>;
  initialValues?: Record<SubjectWeekday, MaybeString> | null;
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

  const handleSubmit = () => {
    for (const day of SUBJECT_WEEKDAYS) {
      if (!values[day] || values[day].trim().length === 0) {
        setValidationError("Assign a subject for every weekday before saving.");
        return;
      }
    }
    setValidationError(null);
    void onSave(sanitizeInitialValues(values));
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
      <ModalSection title="Weekday Assignments">
        <div className="space-y-4">
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
