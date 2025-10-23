"use client";

import BaseModal from "@/components/Common/Modals/BaseModal";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import {
  WEEKDAYS,
  GRADE_LEVELS,
  createEmptySchedule,
  type WeekdayKey,
  type GradeLevel,
  type RemedialSchedule,
  type RemedialPeriodPayload,
} from "../types";

interface AddScheduleModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (schedule: RemedialPeriodPayload) => void;
}

const cloneSchedule = (schedule: RemedialSchedule): RemedialSchedule =>
  JSON.parse(JSON.stringify(schedule)) as RemedialSchedule;

const SUBJECT_OPTIONS = [
  { value: "", label: "No subject" },
  { value: "English", label: "English" },
  { value: "Filipino", label: "Filipino" },
  { value: "Math", label: "Mathematics" },
  { value: "Assessment", label: "Assessment" },
] as const;

const QUARTER_OPTIONS = [
  "1st Quarter",
  "2nd Quarter", 
  "3rd Quarter",
  "4th Quarter"
] as const;

const FIELD_INPUT_STYLE = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-600 transition shadow-sm text-gray-800 placeholder:text-gray-400";
const TIME_INPUT_STYLE = "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-600 transition shadow-sm text-gray-800";

const PRIMARY_WEEKDAY_KEY: WeekdayKey = WEEKDAYS[0].key;

type FlatpickrInstance = {
  setDate: (date: string | Date | Array<string | Date>, triggerChange?: boolean, format?: string) => void;
  clear: () => void;
  destroy: () => void;
};

type FlatpickrFn = (element: HTMLElement, options?: Record<string, unknown>) => FlatpickrInstance;

declare global {
  interface Window {
    flatpickr?: FlatpickrFn;
  }
}

const FLATPICKR_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/flatpickr";
const FLATPICKR_THEME_URL = "https://cdn.jsdelivr.net/npm/flatpickr/dist/themes/material_green.css";

let flatpickrLoader: Promise<void> | null = null;

const loadFlatpickrFromCDN = () => {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.flatpickr) return Promise.resolve();

  if (!flatpickrLoader) {
    flatpickrLoader = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>("script[data-flatpickr]");
      const existingLink = document.querySelector<HTMLLinkElement>("link[data-flatpickr-theme]");

      if (!existingLink) {
        const linkEl = document.createElement("link");
        linkEl.rel = "stylesheet";
        linkEl.href = FLATPICKR_THEME_URL;
        linkEl.setAttribute("data-flatpickr-theme", "true");
        document.head.appendChild(linkEl);
      }

      const fail = (message: string) => {
        flatpickrLoader = null;
        reject(new Error(message));
      };

      const finalize = () => {
        if (window.flatpickr) {
          resolve();
        } else {
          fail("Flatpickr failed to load");
        }
      };

      if (existingScript) {
        if (existingScript.dataset.loaded === "true") {
          finalize();
        } else {
          existingScript.addEventListener("load", finalize, { once: true });
          existingScript.addEventListener(
            "error",
            () => fail("Flatpickr script failed"),
            { once: true },
          );
        }
        return;
      }

      const scriptEl = document.createElement("script");
      scriptEl.src = FLATPICKR_SCRIPT_URL;
      scriptEl.async = true;
      scriptEl.setAttribute("data-flatpickr", "true");
      scriptEl.addEventListener(
        "load",
        () => {
          scriptEl.dataset.loaded = "true";
          finalize();
        },
        { once: true },
      );
      scriptEl.addEventListener(
        "error",
        () => fail("Flatpickr script failed"),
        { once: true },
      );
      document.body.appendChild(scriptEl);
    });
  }

  return flatpickrLoader;
};

const formatDateForStorage = (value: Date | undefined) => {
  if (!value) return "";
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTimeForStorage = (value: Date | undefined) => {
  if (!value) return "";
  const hours = `${value.getHours()}`.padStart(2, "0");
  const minutes = `${value.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
};

const formatTimeLabel = (value: string) => {
  if (!value) return "";
  const [hourStr, minuteStr] = value.split(":");
  const hour = Number(hourStr);
  if (Number.isNaN(hour)) return value;
  const minutes = minuteStr ?? "00";
  const period = hour >= 12 ? "PM" : "AM";
  const normalizedHour = ((hour + 11) % 12) + 1;
  return `${normalizedHour}:${minutes} ${period}`;
};

const formatTimeRangeLabel = (start: string, end: string) => {
  if (!start || !end) return "Not set";
  return `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`;
};

export default function AddScheduleModal({ show, onClose, onSave }: AddScheduleModalProps) {
  const [formData, setFormData] = useState({
    title: "1st Quarter",
    startDate: "",
    endDate: "",
  });
  const [weeklySchedule, setWeeklySchedule] = useState<RemedialSchedule>(() => createEmptySchedule());
  const [error, setError] = useState<string | null>(null);
  const referenceDayPlan = weeklySchedule[PRIMARY_WEEKDAY_KEY];

  const resetForm = () => {
    setFormData({
      title: "1st Quarter",
      startDate: "",
      endDate: "",
    });
    setWeeklySchedule(createEmptySchedule());
    setError(null);
  };

  const handleDateChange = useCallback(
    (field: "startDate" | "endDate") => (event: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: event.target.value }));
    },
    []
  );

  const handleSubjectChange = (dayKey: WeekdayKey, value: string) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        subject: value,
      },
    }));
  };

  const handleGradeTimeChange = useCallback(
    (grade: GradeLevel, field: "startTime" | "endTime", value: string) => {
      setWeeklySchedule((prev) => {
        const updated: RemedialSchedule = { ...prev };

        WEEKDAYS.forEach(({ key }) => {
          const dayPlan = updated[key];
          updated[key] = {
            ...dayPlan,
            grades: {
              ...dayPlan.grades,
              [grade]: {
                ...dayPlan.grades[grade],
                [field]: value,
              },
            },
          };
        });

        return updated;
      });
    },
    [],
  );

  const dateInputRefs = useRef<{ startDate?: HTMLInputElement | null; endDate?: HTMLInputElement | null }>({});
  const datePickersRef = useRef<{ startDate?: FlatpickrInstance | null; endDate?: FlatpickrInstance | null }>({});
  const timeInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const timePickersRef = useRef<Record<string, FlatpickrInstance | null>>({});

  const registerDateInput = useCallback(
    (field: "startDate" | "endDate") => (element: HTMLInputElement | null) => {
      const existingInstance = datePickersRef.current[field];
      if (!element) {
        dateInputRefs.current[field] = null;
        if (existingInstance) {
          existingInstance.destroy();
          delete datePickersRef.current[field];
        }
        return;
      }
      dateInputRefs.current[field] = element;
    },
    [],
  );

  const registerTimeInput = useCallback(
    (grade: GradeLevel, field: "startTime" | "endTime") => (element: HTMLInputElement | null) => {
      const key = `${grade}|${field}`;
      const existingInstance = timePickersRef.current[key];
      if (!element) {
        timeInputRefs.current[key] = null;
        if (existingInstance) {
          existingInstance.destroy();
          delete timePickersRef.current[key];
        }
        return;
      }
      timeInputRefs.current[key] = element;
    },
    [],
  );

  const initializeFlatpickr = useCallback(async () => {
    if (!show || typeof window === "undefined") return;

    try {
      await loadFlatpickrFromCDN();
    } catch (error) {
      console.error("Failed to load Flatpickr from CDN", error);
    }

    const fp = window.flatpickr;
    if (!fp || !show) return;

    ( ["startDate", "endDate"] as const ).forEach((field) => {
      const input = dateInputRefs.current[field];
      if (!input) return;

      if (!datePickersRef.current[field]) {
        datePickersRef.current[field] = fp(input, {
          altInput: true,
          altFormat: "F j, Y",
          dateFormat: "Y-m-d",
          allowInput: true,
          altInputClass: FIELD_INPUT_STYLE,
          onValueUpdate: (selectedDates: Date[]) => {
            const nextValue = selectedDates.length > 0 ? formatDateForStorage(selectedDates[0]) : "";
            setFormData((prev) => ({ ...prev, [field]: nextValue }));
          },
        });
      }

      const currentValue = formData[field];
      if (currentValue) {
        datePickersRef.current[field]?.setDate(currentValue, false, "Y-m-d");
      } else {
        datePickersRef.current[field]?.clear();
      }
    });

    Object.entries(timeInputRefs.current).forEach(([key, element]) => {
      if (!element) return;
      const [gradeStr, field] = key.split("|");
      const grade = Number(gradeStr) as GradeLevel;

      if (!timePickersRef.current[key]) {
        timePickersRef.current[key] = fp(element, {
          enableTime: true,
          noCalendar: true,
          minuteIncrement: 5,
          altInput: true,
          altFormat: "h:i K",
          dateFormat: "H:i",
          allowInput: true,
          altInputClass: TIME_INPUT_STYLE,
          onValueUpdate: (selectedDates: Date[]) => {
            const nextValue = selectedDates.length > 0 ? formatTimeForStorage(selectedDates[0]) : "";
            handleGradeTimeChange(grade, field as "startTime" | "endTime", nextValue);
          },
        });
      }

      const storedValue = weeklySchedule[PRIMARY_WEEKDAY_KEY].grades[grade][field as "startTime" | "endTime"];
      if (storedValue) {
        timePickersRef.current[key]?.setDate(storedValue, false, "H:i");
      } else {
        timePickersRef.current[key]?.clear();
      }
    });
  }, [formData.endDate, formData.startDate, handleGradeTimeChange, show, weeklySchedule]);

  useEffect(() => {
    initializeFlatpickr();
  }, [initializeFlatpickr]);

  useEffect(() => {
    if (show) return;

    ( ["startDate", "endDate"] as const ).forEach((field) => {
      const instance = datePickersRef.current[field];
      if (instance) {
        instance.destroy();
        delete datePickersRef.current[field];
      }
    });
    dateInputRefs.current = {};

    Object.keys(timePickersRef.current).forEach((key) => {
      const instance = timePickersRef.current[key];
      if (instance) {
        instance.destroy();
        delete timePickersRef.current[key];
      }
    });
    timeInputRefs.current = {};
  }, [show]);

  const validateSchedule = () => {
    if (!formData.startDate || !formData.endDate) {
      return "Start and end dates are required.";
    }

    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      return "End date cannot be before start date.";
    }

    for (const { key, label } of WEEKDAYS) {
      const dayPlan = weeklySchedule[key];
      let hasCompleteTime = false;

      for (const grade of GRADE_LEVELS) {
        const { startTime, endTime } = dayPlan.grades[grade];
        const hasStart = Boolean(startTime);
        const hasEnd = Boolean(endTime);

        if (hasStart !== hasEnd) {
          return `Complete the time range for Grade ${grade} on ${label}.`;
        }

        if (hasStart && hasEnd) {
          hasCompleteTime = true;
          if (endTime <= startTime) {
            return `End time must be after start time for Grade ${grade} on ${label}.`;
          }
        }
      }

      if (hasCompleteTime && !dayPlan.subject.trim()) {
        return `Please set the subject for ${label}.`;
      }
    }

    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const scheduleError = validateSchedule();
    if (scheduleError) {
      setError(scheduleError);
      return;
    }

    const scheduleToSave = cloneSchedule(weeklySchedule);
    const newSchedule: RemedialPeriodPayload = {
      id: Date.now(),
      title: formData.title,
      startDate: new Date(formData.startDate),
      endDate: new Date(formData.endDate),
      isActive: false,
      schedule: scheduleToSave,
    };
    
    onSave(newSchedule);
    handleClose();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const footer = (
    <>
      <DangerButton type="button" onClick={handleClose}>
        Cancel
      </DangerButton>
      <PrimaryButton type="submit" form="schedule-form">
        Create Schedule
      </PrimaryButton>
    </>
  );

  if (!show) return null;

  return (
    <BaseModal
      show={show}
      onClose={handleClose}
      title="Create Remedial Schedule"
      maxWidth="4xl"
      footer={footer}
    >
      <form id="schedule-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Schedule Period Section */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule Period</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quarter
              </label>
              <select
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={FIELD_INPUT_STYLE}
                required
              >
                {QUARTER_OPTIONS.map(quarter => (
                  <option key={quarter} value={quarter}>{quarter}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                ref={registerDateInput("startDate")}
                type="date"
                value={formData.startDate}
                onChange={handleDateChange("startDate")}
                className={FIELD_INPUT_STYLE}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                ref={registerDateInput("endDate")}
                type="date"
                value={formData.endDate}
                onChange={handleDateChange("endDate")}
                className={FIELD_INPUT_STYLE}
                required
              />
            </div>
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Grade Time Slots */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Grade Time Slots</h3>
          <p className="text-sm text-gray-600 mb-6">
            Times set here apply automatically to every weekday for the selected grade level.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {GRADE_LEVELS.map((grade) => {
              const gradePlan = referenceDayPlan?.grades[grade];
              const startKey = `${grade}|startTime`;
              const endKey = `${grade}|endTime`;
              return (
                <div key={grade} className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-semibold text-gray-900">Grade {grade}</h4>
                      <p className="text-xs text-gray-500">Applies Monday through Friday</p>
                    </div>
                    {(gradePlan?.startTime || gradePlan?.endTime) && (
                      <button
                        type="button"
                        onClick={() => {
                          handleGradeTimeChange(grade, "startTime", "");
                          handleGradeTimeChange(grade, "endTime", "");
                          timePickersRef.current[startKey]?.clear();
                          timePickersRef.current[endKey]?.clear();
                        }}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                      <input
                        ref={registerTimeInput(grade, "startTime")}
                        type="time"
                        value={gradePlan?.startTime ?? ""}
                        onChange={(event) => handleGradeTimeChange(grade, "startTime", event.target.value)}
                        className={TIME_INPUT_STYLE}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
                      <input
                        ref={registerTimeInput(grade, "endTime")}
                        type="time"
                        value={gradePlan?.endTime ?? ""}
                        onChange={(event) => handleGradeTimeChange(grade, "endTime", event.target.value)}
                        className={TIME_INPUT_STYLE}
                      />
                    </div>
                  </div>

                  <p className="mt-3 text-xs font-medium text-gray-600">
                    Current slot: {formatTimeRangeLabel(gradePlan?.startTime ?? "", gradePlan?.endTime ?? "")}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Schedule Section */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Subjects</h3>
          <p className="text-sm text-gray-600 mb-6">
            Assign the subject focus for each remedial day. Grade time slots above are applied automatically.
          </p>

          <div className="space-y-6">
            {WEEKDAYS.map(({ key, label }) => {
              const dayPlan = weeklySchedule[key];
              return (
                <div key={key} className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-base font-semibold text-gray-900">{label}</h4>
                    <div className="w-48">
                      <select
                        value={dayPlan.subject}
                        onChange={(e) => handleSubjectChange(key, e.target.value)}
                        className={FIELD_INPUT_STYLE}
                      >
                        {SUBJECT_OPTIONS.map((subject) => (
                          <option key={subject.value} value={subject.value}>
                            {subject.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {GRADE_LEVELS.map((grade) => {
                      const gradePlan = dayPlan.grades[grade];
                      return (
                        <div key={grade} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <h5 className="text-sm font-semibold text-gray-700">Grade {grade}</h5>
                          <p className="mt-2 text-xs font-medium text-gray-600">
                            {formatTimeRangeLabel(gradePlan.startTime, gradePlan.endTime)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </form>
    </BaseModal>
  );
}