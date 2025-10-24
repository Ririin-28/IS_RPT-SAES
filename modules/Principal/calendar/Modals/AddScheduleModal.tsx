import React, { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import BaseModal, { ModalSection, ModalLabel } from "@/components/Common/Modals/BaseModal";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import { RemedialPeriodPayload, RemedialSchedule, createEmptySchedule, WEEKDAYS, GRADE_LEVELS } from "../types";

interface AddScheduleModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (schedule: RemedialPeriodPayload) => void;
}

const QUARTERS = [
  { value: "1st", label: "1st Quarter" },
  { value: "2nd", label: "2nd Quarter" },
];

const SUBJECTS = ["English", "Filipino", "Math", "Assessment"];
const FIELD_BASE_CLASS = "w-full rounded-xl border border-zinc-300 bg-white/95 px-3 py-2.5 text-sm text-zinc-900 shadow-sm transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 placeholder:text-zinc-500";

const FLATPICKR_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/flatpickr";
const FLATPICKR_CSS_URL = "https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css";
const FLATPICKR_CUSTOM_STYLE_ID = "flatpickr-monochrome-theme";
const FLATPICKR_INPUT_CLASS = "flatpickr-mono-input";
const FLATPICKR_HIDDEN_INPUT_CLASS = "flatpickr-hidden-input";

const FLATPICKR_CUSTOM_STYLES = `
  .flatpickr-calendar {
    border-radius: 14px;
    border: 1px solid #d4d4d8;
    box-shadow: 0 30px 60px -20px rgba(15, 23, 42, 0.25);
    padding: 0.75rem 0.5rem 1rem;
    background: #f8fafc;
    min-width: 20rem;
  }

  .flatpickr-months {
    border-bottom: 1px solid rgba(148, 163, 184, 0.4);
    margin-bottom: 0.5rem;
  }

  .flatpickr-current-month {
    font-family: "Inter", system-ui, sans-serif;
    font-size: 0.95rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #1f2937;
  }

  .flatpickr-weekdays {
    color: #475569;
    font-weight: 600;
    letter-spacing: 0.08em;
  }

  .flatpickr-weekdays .flatpickr-weekday {
    font-size: 0.7rem;
    text-transform: uppercase;
  }

  .flatpickr-days {
    padding: 0.4rem 0.6rem 0.75rem;
  }

  .flatpickr-day,
  .flatpickr-time .flatpickr-time-separator,
  .flatpickr-time .numInputWrapper,
  .flatpickr-time input {
    font-family: "Inter", system-ui, sans-serif;
  }

  .flatpickr-day {
    color: #111827;
    border-radius: 10px;
    width: 2.35rem;
    height: 2.35rem;
    line-height: 2.35rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0.125rem;
  }
  

  .flatpickr-day.today {
    border: 1px solid #0f172a;
  }

  .flatpickr-day.selected,
  .flatpickr-day.startRange,
  .flatpickr-day.endRange,
  .flatpickr-day.selected:hover {
    background: #0f172a;
    color: #f8fafc;
    border: none;
  }

  .flatpickr-day:hover,
  .flatpickr-day:focus {
    background: rgba(15, 23, 42, 0.1);
  }

  .flatpickr-time input {
    color: #0f172a;
  }

  .flatpickr-time input:focus {
    border-color: #0f172a;
  }

  .flatpickr-mono-input,
  .flatpickr-input[readonly] {
    width: 100%;
    border-radius: 10px;
    border: 1px solid #d4d4d8;
    background: #ffffff;
    color: #111827;
    padding: 0.625rem 0.75rem;
    font-size: 0.95rem;
    line-height: 1.4;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    box-shadow: inset 0 1px 1px rgba(15, 23, 42, 0.05);
  }

  .flatpickr-mono-input:focus,
  .flatpickr-input[readonly]:focus {
    outline: none;
    border-color: #0f172a;
    box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.1);
  }

  .flatpickr-months .flatpickr-prev,
  .flatpickr-months .flatpickr-next {
    color: #0f172a;
  }

  .flatpickr-hidden-input {
    position: absolute !important;
    opacity: 0 !important;
    pointer-events: none !important;
    width: 0 !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
  }
`;

type FlatpickrInstance = {
  clear: () => void;
  destroy: () => void;
  setDate: (date: Date | string | Date[], triggerChange?: boolean) => void;
  input: HTMLInputElement;
  altInput?: HTMLInputElement;
};

declare global {
  interface Window {
    flatpickr?: (
      element: HTMLInputElement,
      config?: Record<string, any>
    ) => FlatpickrInstance;
  }
}

const ensureFlatpickrAssets = () => {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  const promises: Promise<void>[] = [];

  if (!document.querySelector(`link[data-flatpickr-css="true"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${FLATPICKR_CSS_URL}`;
    link.setAttribute("data-flatpickr-css", "true");
    document.head.appendChild(link);
  }

  if (!document.getElementById(FLATPICKR_CUSTOM_STYLE_ID)) {
    const style = document.createElement("style");
    style.id = FLATPICKR_CUSTOM_STYLE_ID;
    style.textContent = FLATPICKR_CUSTOM_STYLES;
    document.head.appendChild(style);
  }

  if (window.flatpickr) {
    return Promise.resolve();
  }

  promises.push(
    new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(`script[data-flatpickr-script="true"]`);

      if (existingScript) {
        if (existingScript.getAttribute("data-loaded") === "true") {
          resolve();
        } else {
          existingScript.addEventListener("load", () => resolve());
          existingScript.addEventListener("error", () => reject(new Error("Failed to load flatpickr script")));
        }
        return;
      }

      const script = document.createElement("script");
      script.src = `${FLATPICKR_SCRIPT_URL}`;
      script.async = true;
      script.defer = true;
      script.setAttribute("data-flatpickr-script", "true");
      script.addEventListener("load", () => {
        script.setAttribute("data-loaded", "true");
        resolve();
      });
      script.addEventListener("error", () => {
        reject(new Error("Failed to load flatpickr script"));
      });
      document.head.appendChild(script);
    })
  );

  return Promise.all(promises).then(() => undefined);
};

export default function AddScheduleModal({ show, onClose, onSave }: AddScheduleModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm();

  const [flatpickrReady, setFlatpickrReady] = useState(false);
  const [timeSlots, setTimeSlots] = useState<{ [key: number]: { start: string; end: string } }>({});
  const [subjectSchedules, setSubjectSchedules] = useState<{ [key: string]: string }>({});
  const quarterRegister = register("quarter", { required: "Quarter is required" });
  const startDateRegister = register("startDate", { required: "Start date is required" });
  const endDateRegister = register("endDate", { required: "End date is required" });

  const startDateRef = useRef<HTMLInputElement | null>(null);
  const endDateRef = useRef<HTMLInputElement | null>(null);
  const datePickerRefs = useRef<{ start?: FlatpickrInstance | null; end?: FlatpickrInstance | null }>({});
  const timePickerRefs = useRef<Record<number, { start?: FlatpickrInstance | null; end?: FlatpickrInstance | null }>>({});
  const timeInputRefs = useRef<Record<number, { start: HTMLInputElement | null; end: HTMLInputElement | null }>>({});
  const latestTimeSlots = useRef(timeSlots);

  const handleTimeSlotChange = useCallback((grade: number, field: "start" | "end", value: string) => {
    setTimeSlots(prev => {
      const existing = prev[grade] ?? { start: "", end: "" };
      return {
        ...prev,
        [grade]: {
          ...existing,
          [field]: value,
        },
      };
    });
  }, []);

  const handleSubjectChange = (day: string, subject: string) => {
    setSubjectSchedules(prev => ({
      ...prev,
      [day]: subject
    }));
  };

  const triggerInputEvents = useCallback((input: HTMLInputElement | null) => {
    if (!input) return;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, []);

  const applyMonochromeInputStyle = useCallback((instance: FlatpickrInstance | null | undefined, placeholder: string) => {
    if (!instance) return;
    const target = instance.altInput ?? instance.input;
    if (!target) return;
    target.classList.add(FLATPICKR_INPUT_CLASS);
    if (placeholder && !target.getAttribute("placeholder")) {
      target.setAttribute("placeholder", placeholder);
    }
    instance.input.classList.add(FLATPICKR_HIDDEN_INPUT_CLASS);
  }, []);

  const revealNativeInput = useCallback((input: HTMLInputElement | null | undefined) => {
    if (!input) return;
    input.classList.remove(FLATPICKR_HIDDEN_INPUT_CLASS);
  }, []);

  const destroyAllPickers = useCallback(() => {
    if (datePickerRefs.current.start) {
      revealNativeInput(datePickerRefs.current.start.input);
      datePickerRefs.current.start.destroy();
      datePickerRefs.current.start = null;
    } else {
      revealNativeInput(startDateRef.current);
    }

    if (datePickerRefs.current.end) {
      revealNativeInput(datePickerRefs.current.end.input);
      datePickerRefs.current.end.destroy();
      datePickerRefs.current.end = null;
    } else {
      revealNativeInput(endDateRef.current);
    }

    GRADE_LEVELS.forEach(grade => {
      const gradePickers = timePickerRefs.current[grade];
      const refs = timeInputRefs.current[grade];
      if (gradePickers?.start) {
        revealNativeInput(gradePickers.start.input);
        gradePickers.start.destroy();
      } else {
        revealNativeInput(refs?.start);
      }

      if (gradePickers?.end) {
        revealNativeInput(gradePickers.end.input);
        gradePickers.end.destroy();
      } else {
        revealNativeInput(refs?.end);
      }

      timePickerRefs.current[grade] = { start: null, end: null };
    });
  }, [revealNativeInput]);

  const clearAllPickers = useCallback(() => {
    datePickerRefs.current.start?.clear?.();
    datePickerRefs.current.end?.clear?.();
    GRADE_LEVELS.forEach(grade => {
      const gradePickers = timePickerRefs.current[grade];
      gradePickers?.start?.clear?.();
      gradePickers?.end?.clear?.();
    });
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.flatpickr) {
      setFlatpickrReady(true);
    }
  }, []);

  useEffect(() => {
    latestTimeSlots.current = timeSlots;
  }, [timeSlots]);

  useEffect(() => {
    if (!show) return;

    let isMounted = true;
    ensureFlatpickrAssets()
      .then(() => {
        if (isMounted) {
          setFlatpickrReady(true);
        }
      })
      .catch(() => {
        if (isMounted) {
          setFlatpickrReady(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [show]);

  useEffect(() => {
    if (!show || !flatpickrReady || typeof window === "undefined" || !window.flatpickr) {
      return;
    }

    const { flatpickr } = window;

    if (startDateRef.current) {
      datePickerRefs.current.start?.destroy?.();
      const instance = flatpickr(startDateRef.current, {
        altInput: true,
        altFormat: "F j, Y",
        dateFormat: "Y-m-d",
        allowInput: true,
        disableMobile: true,
        defaultDate: startDateRef.current.value || undefined,
        onReady: (_selectedDates: Date[], _dateStr: string, inst: FlatpickrInstance) => {
          applyMonochromeInputStyle(inst, "Select start date");
          if (!startDateRef.current?.value) {
            inst.clear();
          }
        },
        onOpen: (_selectedDates: Date[], _dateStr: string, inst: FlatpickrInstance) => {
          applyMonochromeInputStyle(inst, "Select start date");
        },
        onChange: (_selectedDates: Date[], _dateStr: string, inst: FlatpickrInstance) => {
          triggerInputEvents(inst.input);
        },
        onClose: (_selectedDates: Date[], _dateStr: string, inst: FlatpickrInstance) => {
          triggerInputEvents(inst.input);
        },
      });
      applyMonochromeInputStyle(instance, "Select start date");
      datePickerRefs.current.start = instance;
    }

    if (endDateRef.current) {
      datePickerRefs.current.end?.destroy?.();
      const instance = flatpickr(endDateRef.current, {
        altInput: true,
        altFormat: "F j, Y",
        dateFormat: "Y-m-d",
        allowInput: true,
        disableMobile: true,
        defaultDate: endDateRef.current.value || undefined,
        onReady: (_selectedDates: Date[], _dateStr: string, inst: FlatpickrInstance) => {
          applyMonochromeInputStyle(inst, "Select end date");
          if (!endDateRef.current?.value) {
            inst.clear();
          }
        },
        onOpen: (_selectedDates: Date[], _dateStr: string, inst: FlatpickrInstance) => {
          applyMonochromeInputStyle(inst, "Select end date");
        },
        onChange: (_selectedDates: Date[], _dateStr: string, inst: FlatpickrInstance) => {
          triggerInputEvents(inst.input);
        },
        onClose: (_selectedDates: Date[], _dateStr: string, inst: FlatpickrInstance) => {
          triggerInputEvents(inst.input);
        },
      });
      applyMonochromeInputStyle(instance, "Select end date");
      datePickerRefs.current.end = instance;
    }

    GRADE_LEVELS.forEach(grade => {
      timePickerRefs.current[grade] = timePickerRefs.current[grade] ?? { start: null, end: null };
      const gradeRefs = timeInputRefs.current[grade] ?? { start: null, end: null };
      timeInputRefs.current[grade] = gradeRefs;

      if (gradeRefs.start) {
        timePickerRefs.current[grade].start?.destroy?.();
        const instance = flatpickr(gradeRefs.start, {
          enableTime: true,
          noCalendar: true,
          altInput: true,
          altFormat: "h:i K",
          dateFormat: "H:i",
          allowInput: true,
          disableMobile: true,
          minuteIncrement: 5,
          defaultDate: latestTimeSlots.current[grade]?.start || undefined,
          onReady: (_selectedDates: Date[], _dateStr: string, inst: FlatpickrInstance) => {
            applyMonochromeInputStyle(inst, "Start time");
            if (!latestTimeSlots.current[grade]?.start) {
              inst.clear();
            }
          },
          onOpen: (_selectedDates: Date[], _dateStr: string, inst: FlatpickrInstance) => {
            applyMonochromeInputStyle(inst, "Start time");
          },
          onChange: (_selectedDates: Date[], dateStr: string) => {
            handleTimeSlotChange(grade, "start", dateStr);
          },
          onClose: (_selectedDates: Date[], dateStr: string) => {
            handleTimeSlotChange(grade, "start", dateStr);
          },
        });
        applyMonochromeInputStyle(instance, "Start time");
        timePickerRefs.current[grade].start = instance;
      }

      if (gradeRefs.end) {
        timePickerRefs.current[grade].end?.destroy?.();
        const instance = flatpickr(gradeRefs.end, {
          enableTime: true,
          noCalendar: true,
          altInput: true,
          altFormat: "h:i K",
          dateFormat: "H:i",
          allowInput: true,
          disableMobile: true,
          minuteIncrement: 5,
          defaultDate: latestTimeSlots.current[grade]?.end || undefined,
          onReady: (_selectedDates: Date[], _dateStr: string, inst: FlatpickrInstance) => {
            applyMonochromeInputStyle(inst, "End time");
            if (!latestTimeSlots.current[grade]?.end) {
              inst.clear();
            }
          },
          onOpen: (_selectedDates: Date[], _dateStr: string, inst: FlatpickrInstance) => {
            applyMonochromeInputStyle(inst, "End time");
          },
          onChange: (_selectedDates: Date[], dateStr: string) => {
            handleTimeSlotChange(grade, "end", dateStr);
          },
          onClose: (_selectedDates: Date[], dateStr: string) => {
            handleTimeSlotChange(grade, "end", dateStr);
          },
        });
        applyMonochromeInputStyle(instance, "End time");
        timePickerRefs.current[grade].end = instance;
      }
    });

    return () => {
      destroyAllPickers();
    };
  }, [
    show,
    flatpickrReady,
    applyMonochromeInputStyle,
    destroyAllPickers,
    handleTimeSlotChange,
    triggerInputEvents,
  ]);

  const onSubmit = (data: any) => {
    // Build the schedule
    const schedule: RemedialSchedule = createEmptySchedule();
    WEEKDAYS.forEach(({ key }) => {
      const dayKey = key as keyof RemedialSchedule;
      const subject = subjectSchedules[key] || "";
      schedule[dayKey].subject = subject;
      GRADE_LEVELS.forEach(grade => {
        const slot = timeSlots[grade];
        if (slot) {
          schedule[dayKey].grades[grade] = {
            startTime: slot.start,
            endTime: slot.end,
          };
        }
      });
    });

    const scheduleData: RemedialPeriodPayload = {
      id: Date.now(), // Simple ID generation
      title: `${data.quarter} Quarter Remedial Schedule`,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      isActive: false,
      schedule,
    };

    onSave(scheduleData);
    reset();
    setTimeSlots({});
    setSubjectSchedules({});
    clearAllPickers();
    onClose();
  };

  return (
    <BaseModal
      show={show}
      onClose={onClose}
      title="Add Schedule"
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Schedule Period */}
        <ModalSection title="Schedule Period">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <ModalLabel required>Quarter</ModalLabel>
              <select
                className={FIELD_BASE_CLASS}
                {...quarterRegister}
              >
                <option value="">Select Quarter</option>
                {QUARTERS.map(quarter => (
                  <option key={quarter.value} value={quarter.value}>
                    {quarter.label}
                  </option>
                ))}
              </select>
              {errors.quarter && <span className="text-red-500 text-xs">{errors.quarter.message as string}</span>}
            </div>
            <div>
              <ModalLabel required>Start Date</ModalLabel>
              <input
                type={flatpickrReady ? "text" : "date"}
                placeholder="Select start date"
                className={FIELD_BASE_CLASS}
                autoComplete="off"
                {...startDateRegister}
                ref={element => {
                  startDateRegister.ref(element);
                  startDateRef.current = element;
                }}
              />
              {errors.startDate && <span className="text-red-500 text-xs">{errors.startDate.message as string}</span>}
            </div>
            <div>
              <ModalLabel required>End Date</ModalLabel>
              <input
                type={flatpickrReady ? "text" : "date"}
                placeholder="Select end date"
                className={FIELD_BASE_CLASS}
                autoComplete="off"
                {...endDateRegister}
                ref={element => {
                  endDateRegister.ref(element);
                  endDateRef.current = element;
                }}
              />
              {errors.endDate && <span className="text-red-500 text-xs">{errors.endDate.message as string}</span>}
            </div>
          </div>
        </ModalSection>

        {/* General Schedule of Subjects */}
        <ModalSection title="General Schedule of Subjects">
          {/* Time Slots per Grade Level */}
          <div className="space-y-4">
            <h4 className="text-base font-semibold text-zinc-800">Time Slots per Grade Level</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {GRADE_LEVELS.map(grade => (
                <div key={grade} className="rounded-xl border border-zinc-200 bg-white/80 p-4 shadow-sm">
                  <h5 className="mb-2 text-sm font-semibold text-zinc-700">Grade {grade}</h5>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Start Time</label>
                      <input
                        type={flatpickrReady ? "text" : "time"}
                        className={FIELD_BASE_CLASS}
                        placeholder="Start time"
                        autoComplete="off"
                        value={timeSlots[grade]?.start || ""}
                        onChange={(e) => handleTimeSlotChange(grade, "start", e.target.value)}
                        ref={element => {
                          const existing = timeInputRefs.current[grade] ?? { start: null, end: null };
                          existing.start = element;
                          timeInputRefs.current[grade] = existing;
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">End Time</label>
                      <input
                        type={flatpickrReady ? "text" : "time"}
                        className={FIELD_BASE_CLASS}
                        placeholder="End time"
                        autoComplete="off"
                        value={timeSlots[grade]?.end || ""}
                        onChange={(e) => handleTimeSlotChange(grade, "end", e.target.value)}
                        ref={element => {
                          const existing = timeInputRefs.current[grade] ?? { start: null, end: null };
                          existing.end = element;
                          timeInputRefs.current[grade] = existing;
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Subjects per Day */}
          <div className="space-y-4">
            <h4 className="text-base font-semibold text-zinc-800">Subjects per Day (Monday to Friday)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {WEEKDAYS.map(({ key, label }) => (
                <div key={key} className="rounded-xl border border-zinc-200 bg-white/80 p-4 shadow-sm">
                  <h5 className="mb-2 text-sm font-semibold text-zinc-700">{label}</h5>
                  <select
                    className={FIELD_BASE_CLASS}
                    value={subjectSchedules[key] || ""}
                    onChange={(e) => handleSubjectChange(key, e.target.value)}
                  >
                    <option value="">Select Subject</option>
                    {SUBJECTS.map(subject => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </ModalSection>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit">
            Save Schedule
          </PrimaryButton>
        </div>
      </form>
    </BaseModal>
  );
}
