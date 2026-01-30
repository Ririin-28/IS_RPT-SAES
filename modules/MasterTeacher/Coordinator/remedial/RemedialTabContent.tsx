"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import EditContentModal, { type FlashcardContent } from "./Modals/EditContentModal";

export type RemedialEntry = {
  id: number;
  title: string;
  time: string;
  date: string;
};

export type RemedialLevelConfig = {
  label: string;
  initialEntries: RemedialEntry[];
  inlineEditable: boolean;
  showPlay?: boolean;
  allowFlashcardEdit?: boolean;
  allowSeeAll?: boolean;
};

export type RemedialSubjectConfig = {
  storageKey: string;
  validationMessage: string;
  playPath?: string;
  flashcardsStorageKey?: string;
  flashcardsInitial?: FlashcardContent[];
  levels: RemedialLevelConfig[];
};

type RemedialTabContentProps = {
  level: string;
  config: RemedialSubjectConfig;
  subject: string;
  gradeLevel?: string | null;
  requestId?: string | null;
};

type RemedialsByLevel = Record<string, RemedialEntry[]>;

const formatTo12Hour = (time24: string | null): string => {
  if (!time24) return "";
  const parts = time24.split(":");
  let hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return "";
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes.toString().padStart(2, "0")} ${period}`;
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

const cloneInitialMap = (levels: RemedialLevelConfig[]): RemedialsByLevel =>
  levels.reduce<RemedialsByLevel>((acc, level) => {
    acc[level.label] = level.initialEntries.map((entry) => ({ ...entry }));
    return acc;
  }, {});

const normalizeEntries = (entries: unknown, fallback: RemedialEntry[]): RemedialEntry[] => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return fallback.map((item) => ({ ...item }));
  }

  return entries.map((candidate: any, index) => {
    const template = fallback[index] ?? { id: 0, title: "", time: "", date: "" };

    return {
      id: typeof candidate?.id === "number" ? candidate.id : template.id,
      title:
        typeof candidate?.title === "string" && candidate.title.trim() ? candidate.title : template.title,
      time:
        typeof candidate?.time === "string" && candidate.time.trim()
          ? candidate.time
          : template.time,
      date:
        typeof candidate?.date === "string" && candidate.date.trim()
          ? candidate.date
          : template.date,
    };
  });
};

const isValidFlashcards = (value: unknown): value is FlashcardContent[] => {
  if (!Array.isArray(value) || value.length === 0) return false;

  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as { sentence?: unknown; highlights?: unknown; answer?: unknown };
    if (typeof candidate.sentence !== "string") return false;
    if (!Array.isArray(candidate.highlights)) return false;
    if (!candidate.highlights.every((entry) => typeof entry === "string")) return false;
    if (candidate.answer !== undefined && typeof candidate.answer !== "string") return false;
    return true;
  });
};

export default function RemedialTabContent({ level, config, subject, gradeLevel, requestId }: RemedialTabContentProps) {
  const { levels, storageKey, validationMessage, flashcardsInitial, flashcardsStorageKey, playPath } = config;
  const levelConfig = useMemo(
    () => levels.find((item) => item.label === level) ?? levels[0],
    [level, levels],
  );

  const [remedialsByLevel, setRemedialsByLevel] = useState<RemedialsByLevel>(() => cloneInitialMap(levels));
  const [flashcards, setFlashcards] = useState<FlashcardContent[]>(() =>
    (flashcardsInitial ?? []).map((card) => ({ ...card })),
  );
  const hasHydrated = useRef(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<RemedialEntry | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weeklySchedule, setWeeklySchedule] = useState<Array<{ day: string; startTime: string | null; endTime: string | null }>>([]);

  const remedials = (remedialsByLevel[levelConfig.label] ?? []).filter((r) => r.title.trim() !== "");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasHydrated.current) return;

    window.localStorage.setItem(storageKey, JSON.stringify(remedialsByLevel));
  }, [remedialsByLevel, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasHydrated.current) return;
    if (!flashcardsStorageKey) return;

    window.localStorage.setItem(flashcardsStorageKey, JSON.stringify(flashcards));
  }, [flashcards, flashcardsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedValue = window.localStorage.getItem(storageKey);
    if (storedValue) {
      try {
        const parsed = JSON.parse(storedValue) as Partial<RemedialsByLevel>;
        const hydrated = levels.reduce<RemedialsByLevel>((acc, currentLevel) => {
          const normalized = normalizeEntries(parsed?.[currentLevel.label], currentLevel.initialEntries);
          acc[currentLevel.label] = normalized;
          return acc;
        }, {} as RemedialsByLevel);
        setRemedialsByLevel(hydrated);
      } catch {
        setRemedialsByLevel(cloneInitialMap(levels));
      }
    } else {
      const initial = cloneInitialMap(levels);
      setRemedialsByLevel(initial);
      window.localStorage.setItem(storageKey, JSON.stringify(initial));
    }

    if (flashcardsStorageKey) {
      const storedFlashcards = window.localStorage.getItem(flashcardsStorageKey);
      if (storedFlashcards) {
        try {
          const parsed = JSON.parse(storedFlashcards);
          if (isValidFlashcards(parsed)) {
            setFlashcards(parsed);
          } else if (flashcardsInitial) {
            window.localStorage.setItem(flashcardsStorageKey, JSON.stringify(flashcardsInitial));
            setFlashcards(flashcardsInitial);
          }
        } catch {
          if (flashcardsInitial) {
            window.localStorage.setItem(flashcardsStorageKey, JSON.stringify(flashcardsInitial));
            setFlashcards(flashcardsInitial);
          }
        }
      } else if (flashcardsInitial) {
        window.localStorage.setItem(flashcardsStorageKey, JSON.stringify(flashcardsInitial));
        setFlashcards(flashcardsInitial);
      }
    }

    hasHydrated.current = true;
  }, [flashcardsInitial, flashcardsStorageKey, levels, storageKey]);

  // Fetch weekly subject schedule
  useEffect(() => {
    async function fetchWeeklySchedule() {
      if (!subject) return;
      try {
        const params = new URLSearchParams({ subject });
        if (gradeLevel) params.append("grade", gradeLevel);
        const response = await fetch(`/api/remedial/weekly-schedule?${params.toString()}`);
        const data = await response.json();
        if (data.success && data.schedule) {
          setWeeklySchedule(data.schedule);
        }
      } catch (err) {
        console.warn("Failed to fetch weekly schedule", err);
      }
    }
    fetchWeeklySchedule();
  }, [subject, gradeLevel]);

  // Fetch dynamic calendar activities
  useEffect(() => {
    let cancelled = false;
    const fetchCalendar = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/teacher/calendar", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error ?? "Failed to load schedule");
        }

        if (cancelled) return;

        const rawActivities = Array.isArray(payload.activities) ? payload.activities : [];
        const mapped = rawActivities
          .filter((act: any) => {
            if (!act.subject) return true;
            const lowerSub = act.subject.toLowerCase();
            const targetSub = subject.toLowerCase();
            if (targetSub === "math") return lowerSub.includes("math");
            return lowerSub.startsWith(targetSub.substring(0, 3));
          })
          .map((act: any, idx: number) => {
            const dateStr = act.activityDate ?? act.date ?? "";
            let startTime = act.startTime ? act.startTime.substring(0, 5) : "";
            let endTime = act.endTime ? act.endTime.substring(0, 5) : "";
            
            // If no specific time, look for it in weekly schedule
            if (!startTime && dateStr && weeklySchedule.length > 0) {
              const dateObj = new Date(dateStr);
              if (!isNaN(dateObj.getTime())) {
                const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
                const matchedDay = weeklySchedule.find(s => s.day === dayName);
                if (matchedDay?.startTime) {
                  startTime = matchedDay.startTime;
                  endTime = matchedDay.endTime || "";
                }
              }
            }

            const formattedStart = formatTo12Hour(startTime);
            const formattedEnd = formatTo12Hour(endTime);
            const timeSlot = formattedStart && formattedEnd 
              ? `${formattedStart} - ${formattedEnd}`
              : formattedStart || "??";

            return {
              id: Number.isFinite(Number(act.id)) ? Number(act.id) : 1000 + idx,
              title: act.title ?? "Scheduled Activity",
              time: timeSlot,
              date: dateStr,
            } satisfies RemedialEntry;
          });

        if (mapped.length > 0 && !cancelled) {
          setRemedialsByLevel((prev) => {
            const next = { ...prev };
            // Simple merge: append fetched to current level if they don't exist by title+date
            const currentLevelItems = [...(next[levelConfig.label] ?? [])];
            mapped.forEach((m: RemedialEntry) => {
              const exists = currentLevelItems.some(
                (item) => item.title === m.title && item.date === m.date
              );
              if (!exists) {
                currentLevelItems.push(m);
              }
            });
            next[levelConfig.label] = currentLevelItems;
            return next;
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch calendar for remedial", err);
          setError("Notice: Dynamic schedule items could not be loaded.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCalendar();
    return () => { cancelled = true; };
  }, [subject, levelConfig.label]);

  useEffect(() => {
    setEditingId(null);
    setDraft(null);
    setValidationError(null);
  }, [levelConfig.label]);

  const startEdit = (id: number) => {
    if (!levelConfig.inlineEditable) return;
    const target = remedials.find((item) => item.id === id);
    if (!target) return;

    setValidationError(null);
    setEditingId(id);
    setDraft({ ...target });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setValidationError(null);
  };

  const updateDraft = <K extends keyof RemedialEntry>(key: K, value: RemedialEntry[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = () => {
    if (!draft || !levelConfig.inlineEditable) return;

    const trimmedTitle = draft.title.trim();
    const trimmedTime = draft.time.trim();
    const trimmedDate = draft.date.trim();

    if (!trimmedTitle || !trimmedTime || !trimmedDate) {
      setValidationError(validationMessage);
      return;
    }

    const updated: RemedialEntry = {
      id: draft.id,
      title: trimmedTitle,
      time: trimmedTime,
      date: trimmedDate,
    };

    setRemedialsByLevel((prev) => ({
      ...prev,
      [levelConfig.label]: prev[levelConfig.label].map((item) => (item.id === draft.id ? updated : item)),
    }));

    cancelEdit();
  };

  const handleSaveFlashcards = (updatedFlashcards: FlashcardContent[]) => {
    setFlashcards(updatedFlashcards);
    setIsEditModalOpen(false);
  };

  const rows = remedials.map((remedial, index) => ({
    ...remedial,
    no: index + 1,
    startIndex: index,
  }));

  const showPlayButton = !!levelConfig.showPlay && !!playPath;

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4 sm:mb-6 md:mb-2">
        <div className="flex gap-2" />
      </div>
      {(validationError || error) && (
        <p className="text-sm text-red-600 mb-3">{validationError || error}</p>
      )}





      {levelConfig.allowFlashcardEdit && (
        <EditContentModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          flashcards={flashcards}
          onSave={handleSaveFlashcards}
        />
      )}
    </div>
  );
}
