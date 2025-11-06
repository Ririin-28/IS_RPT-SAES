import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Flatpickr from "react-flatpickr";
import type { Instance as FlatpickrInstance } from "flatpickr/dist/types/instance";
import BaseModal, {
  ModalSection,
  ModalLabel,
  ModalInfoItem,
} from "@/components/Common/Modals/BaseModal";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";

export const WEEKDAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
export type Weekday = typeof WEEKDAY_ORDER[number];

export interface WeeklyScheduleFormData {
  weekStart: string;
  startTime: string;
  endTime: string;
  subjects: Record<Weekday, string>;
}

interface WeeklyScheduleModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (data: WeeklyScheduleFormData) => void;
  initialData?: WeeklyScheduleFormData | null;
  gradeLevel: string;
  allowedSubjects: string[];
  scheduleWindowLabel?: string | null;
  scheduleStartDate?: string | null;
  scheduleEndDate?: string | null;
  scheduleActive?: boolean;
}

const SUBJECT_OPTIONS = ["English", "Filipino", "Math", "Assessment"];

const getMondayForToday = () => {
  const today = new Date();
  const monday = alignToMonday(today);
  return formatDateInputValue(monday);
};

const alignToMonday = (date: Date) => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = (day + 6) % 7; // 0 when Monday
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

const formatDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const EMPTY_SUBJECTS: Record<Weekday, string> = {
  Monday: "",
  Tuesday: "",
  Wednesday: "",
  Thursday: "",
  Friday: "",
};

const parseBoundaryDate = (value?: string | null, mode: "start" | "end" = "start") => {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  if (mode === "end") {
    date.setHours(23, 59, 59, 999);
  }
  return date;
};

export default function WeeklyScheduleModal({
  show,
  onClose,
  onSave,
  initialData,
  gradeLevel,
  allowedSubjects,
  scheduleWindowLabel,
  scheduleStartDate,
  scheduleEndDate,
  scheduleActive = false,
}: WeeklyScheduleModalProps) {
  const [weekStart, setWeekStart] = useState(getMondayForToday());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [subjects, setSubjects] = useState<Record<Weekday, string>>(EMPTY_SUBJECTS);
  const [error, setError] = useState<string | null>(null);
  const startPickerRef = useRef<FlatpickrInstance | null>(null);
  const endPickerRef = useRef<FlatpickrInstance | null>(null);
  const subjectOptions = allowedSubjects.length > 0 ? allowedSubjects : SUBJECT_OPTIONS;
  const subjectLocked = allowedSubjects.length === 1;
  const rangeStart = useMemo(() => parseBoundaryDate(scheduleStartDate, "start"), [scheduleStartDate]);
  const rangeEnd = useMemo(() => parseBoundaryDate(scheduleEndDate, "end"), [scheduleEndDate]);

  const convertTo24Hour = (input: string, fallbackMeridiem?: "AM" | "PM") => {
    const trimmed = input.trim().toUpperCase();
    const match = /^([0-1]?\d):([0-5]\d)\s*(AM|PM)?$/.exec(trimmed);
    if (!match) return "";
    let [, hourPart, minutePart, meridiem] = match;
    let hours = Number(hourPart);
    const minutes = Number(minutePart);
    const period = meridiem ?? fallbackMeridiem;
    if (!period) return "";
    const isPM = period === "PM";
    if (hours === 12) {
      hours = isPM ? 12 : 0;
    } else if (isPM) {
      hours += 12;
    }
    if (hours > 23) return "";
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  const parseTimeToMinutes = (value: string) => {
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  };

  const formatMaskedTime = (value: string) => {
    const upper = value.toUpperCase();
    const digits = upper.replace(/[^0-9]/g, "").slice(0, 4);
    const hours = digits.slice(0, 2);
    const minutes = digits.slice(2);
    let formatted = hours;
    if (digits.length > 2) {
      formatted = `${hours}:${minutes}`;
    }
    const suffixSource = upper.replace(/[^APM]/g, "");
    let meridiem = "";
    if (suffixSource.startsWith("PM")) {
      meridiem = "PM";
    } else if (suffixSource.startsWith("P")) {
      meridiem = "P";
    } else if (suffixSource.startsWith("AM")) {
      meridiem = "AM";
    } else if (suffixSource.startsWith("A")) {
      meridiem = "A";
    }
    if (digits.length >= 4 && meridiem) {
      formatted = `${formatted} ${meridiem.length === 1 ? `${meridiem}M` : meridiem}`;
    }
    return formatted.trim();
  };

  const handleStartTimeChange = (time: string) => {
    setStartTime(time);
    if (time && endTime && parseTimeToMinutes(endTime) <= parseTimeToMinutes(time)) {
      setEndTime("");
    }
  };

  const handleEndTimeChange = (time: string) => {
    setEndTime(time);
  };

  const configureInputMask = (
    instance: FlatpickrInstance,
    onValid: (time: string) => void,
    getCurrentValue: () => string
  ) => {
    const altInput = instance.altInput as HTMLInputElement | null;
    if (!altInput) return;

    altInput.setAttribute("inputmode", "numeric");
    altInput.setAttribute("placeholder", "00:00 AM");
    altInput.maxLength = 8;

    altInput.oninput = (event) => {
      const target = event.target as HTMLInputElement;
      target.value = formatMaskedTime(target.value);
    };

    altInput.onblur = () => {
      const raw = altInput.value.trim();
      if (!raw) {
        instance.clear(false);
        onValid("");
        return;
      }
  const upperRaw = raw.toUpperCase();
  const meridiemFallback = upperRaw.includes("PM") || upperRaw.endsWith("P") ? "PM" : "AM";
      const converted = convertTo24Hour(raw, meridiemFallback);
      if (!converted) {
        const current = getCurrentValue();
        if (current) {
          instance.setDate(current, false);
          const parsed = instance.parseDate(current, "H:i");
          altInput.value = parsed ? instance.formatDate(parsed, "h:i K") : "";
        } else {
          instance.clear(false);
          altInput.value = "";
        }
        return;
      }
      instance.setDate(converted, false);
      const parsedConverted = instance.parseDate(converted, "H:i");
      altInput.value = parsedConverted ? instance.formatDate(parsedConverted, "h:i K") : "";
      onValid(converted);
    };
  };

  useEffect(() => {
    if (show) {
      const baseline = initialData?.weekStart ?? getMondayForToday();
      const baselineDate = alignToMonday(new Date(baseline));
      let resolved = new Date(baselineDate);
      if (scheduleActive && rangeStart) {
        while (resolved < rangeStart) {
          resolved.setDate(resolved.getDate() + 7);
        }
      }
      if (scheduleActive && rangeEnd) {
        const friday = new Date(resolved);
        friday.setDate(friday.getDate() + 4);
        while (friday > rangeEnd) {
          resolved.setDate(resolved.getDate() - 7);
          friday.setDate(friday.getDate() - 7);
          if (scheduleActive && rangeStart && resolved < rangeStart) {
            resolved = alignToMonday(new Date(rangeStart));
            friday.setTime(resolved.getTime());
            friday.setDate(friday.getDate() + 4);
            break;
          }
        }
      }
      setWeekStart(formatDateInputValue(resolved));
      setStartTime(initialData?.startTime ?? "");
      setEndTime(initialData?.endTime ?? "");
      const baselineSubjects = initialData?.subjects
        ?? (subjectLocked && allowedSubjects[0]
          ? WEEKDAY_ORDER.reduce<Record<Weekday, string>>((acc, day) => {
              acc[day] = allowedSubjects[0];
              return acc;
            }, { ...EMPTY_SUBJECTS })
          : { ...EMPTY_SUBJECTS });
      setSubjects(baselineSubjects);
      setError(null);
    }
  }, [show, initialData, subjectLocked, allowedSubjects, rangeEnd, rangeStart, scheduleActive]);

  useEffect(() => {
    if (endPickerRef.current) {
      endPickerRef.current.set("minTime", startTime || null);
    }
  }, [startTime]);

  useEffect(() => {
    if (startPickerRef.current) {
      if (startTime) {
        startPickerRef.current.setDate(startTime, false);
      } else {
        startPickerRef.current.clear(false);
      }
    }
    if (endPickerRef.current) {
      if (endTime) {
        endPickerRef.current.setDate(endTime, false);
      } else {
        endPickerRef.current.clear(false);
      }
    }
  }, [startTime, endTime]);

  if (!show) return null;

  const handleWeekStartInputChange = (value: string) => {
    if (!value) {
      setWeekStart(value);
      return;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return;
    }
    let resolved = alignToMonday(parsed);
    if (scheduleActive && rangeStart) {
      while (resolved < rangeStart) {
        resolved.setDate(resolved.getDate() + 7);
      }
    }
    if (scheduleActive && rangeEnd) {
      const friday = new Date(resolved);
      friday.setDate(friday.getDate() + 4);
      while (friday > rangeEnd) {
        resolved.setDate(resolved.getDate() - 7);
        friday.setDate(friday.getDate() - 7);
        if (scheduleActive && rangeStart && resolved < rangeStart) {
          resolved = alignToMonday(new Date(rangeStart));
          break;
        }
      }
    }
    setWeekStart(formatDateInputValue(resolved));
  };

  const handleSubjectChange = (day: Weekday, value: string) => {
    if (subjectLocked && allowedSubjects[0]) {
      setSubjects((prev) => ({ ...prev, [day]: allowedSubjects[0] }));
      return;
    }
    setSubjects((prev) => ({ ...prev, [day]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (allowedSubjects.length === 0) {
      setError("Subject assignment is required before planning a schedule.");
      return;
    }

    if (!startTime || !endTime) {
      setError("Please select both start and end time.");
      return;
    }

    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    if (endTotalMinutes <= startTotalMinutes) {
      setError("End time must be later than the start time.");
      return;
    }

    const hasUnassignedSubject = WEEKDAY_ORDER.some((day) => !subjects[day]);
    if (hasUnassignedSubject) {
      setError("Please assign a subject for every weekday.");
      return;
    }

    if (scheduleActive && (rangeStart || rangeEnd)) {
      const monday = alignToMonday(new Date(weekStart));
      const outsideDay = WEEKDAY_ORDER.find((_, index) => {
        const candidate = new Date(monday);
        candidate.setDate(candidate.getDate() + index);
        if (rangeStart && candidate < rangeStart) {
          return true;
        }
        if (rangeEnd && candidate > rangeEnd) {
          return true;
        }
        return false;
      });
      if (outsideDay) {
        setError(
          scheduleWindowLabel
            ? `${outsideDay} falls outside the remedial window (${scheduleWindowLabel}).`
            : `${outsideDay} falls outside the remedial window.`,
        );
        return;
      }
    }

    setError(null);
    onSave({
      weekStart,
      startTime,
      endTime,
      subjects,
    });
  };

  return (
    <BaseModal
      show={show}
      onClose={onClose}
      title="Plan Weekly Remediation"
      maxWidth="2xl"
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose} className="px-5 py-2.5">
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" form="weekly-schedule-form" className="px-5 py-2.5">
            Submit Schedule
          </PrimaryButton>
        </>
      }
    >
      <form id="weekly-schedule-form" onSubmit={handleSubmit} className="space-y-6">
        <ModalSection title="Grade Level Handled">
          <ModalInfoItem label="Grade Level" value={gradeLevel} />
        </ModalSection>

        <ModalSection title="Week Selection">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <ModalLabel required>Week Starts On</ModalLabel>
              <input
                type="date"
                value={weekStart}
                min={scheduleStartDate ?? undefined}
                max={scheduleEndDate ?? undefined}
                onChange={(event) => handleWeekStartInputChange(event.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#013300] focus:ring-offset-0"
              />
              <p className="text-xs text-gray-500">
                {scheduleWindowLabel
                  ? `Weeks must stay within ${scheduleWindowLabel}.`
                  : "Select the Monday that starts the remediation week."}
              </p>
            </div>
            <div className="space-y-1">
              <ModalLabel>Remedial Window</ModalLabel>
              <div className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {scheduleWindowLabel ?? "Not yet configured"}
              </div>
              {!scheduleActive && (
                <p className="text-xs text-amber-600">Remedial window must be active before weekly schedules can be applied.</p>
              )}
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Time Slot">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <ModalLabel required>Start Time</ModalLabel>
              <Flatpickr
                value={startTime}
                options={{
                  enableTime: true,
                  noCalendar: true,
                  dateFormat: "H:i",
                  altInput: true,
                  altFormat: "h:i K",
                  allowInput: true,
                  altInputClass:
                    "flatpickr-alt-input w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#013300]",
                }}
                onChange={(_, dateStr) => handleStartTimeChange(dateStr)}
                onValueUpdate={(_, dateStr) => handleStartTimeChange(dateStr)}
                onReady={(_, __, instance) => {
                  startPickerRef.current = instance;
                  configureInputMask(instance, handleStartTimeChange, () => startTime);
                  if (startTime) {
                    instance.setDate(startTime, false);
                  }
                }}
                placeholder="Select start time"
                className="flatpickr-hidden-input"
              />
            </div>
            <div>
              <ModalLabel required>End Time</ModalLabel>
              <Flatpickr
                value={endTime}
                options={{
                  enableTime: true,
                  noCalendar: true,
                  dateFormat: "H:i",
                  altInput: true,
                  altFormat: "h:i K",
                  allowInput: true,
                  minTime: startTime || undefined,
                  altInputClass:
                    "flatpickr-alt-input w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#013300]",
                }}
                onChange={(_, dateStr) => handleEndTimeChange(dateStr)}
                onValueUpdate={(_, dateStr) => handleEndTimeChange(dateStr)}
                onReady={(_, __, instance) => {
                  endPickerRef.current = instance;
                  configureInputMask(instance, handleEndTimeChange, () => endTime);
                  instance.set("minTime", startTime || null);
                  if (endTime) {
                    instance.setDate(endTime, false);
                  }
                }}
                placeholder="Select end time"
                className="flatpickr-hidden-input"
              />
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Subjects Per Day">
          <p className="text-xs text-gray-500">
            Assign the subject focus for each weekday. The chosen time slot applies across all days.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {WEEKDAY_ORDER.map((day) => (
              <div key={day} className="rounded-lg border border-gray-200 p-3">
                <div className="text-sm font-semibold text-gray-800">{day}</div>
                <select
                  value={subjects[day]}
                  onChange={(event) => handleSubjectChange(day, event.target.value)}
                  className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black transition-all"
                  required
                  disabled={subjectLocked}
                >
                  {!subjectLocked && (
                    <option value="" disabled>
                      Select Subject
                    </option>
                  )}
                  {subjectOptions.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </ModalSection>

        {error && <div className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">{error}</div>}
      </form>
    </BaseModal>
  );
}
