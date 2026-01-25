"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import EditContentModal, { type FlashcardContent } from "./Modals/EditContentModal";
import ScheduledRemedialList from "./ScheduledRemedialList";

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
};

type RemedialsByLevel = Record<string, RemedialEntry[]>;

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
  const fallbackList = fallback.length > 0 ? fallback : [{ id: 0, title: "", time: "", date: "" }];

  if (!Array.isArray(entries) || entries.length === 0) {
    return fallbackList.map((item) => ({ ...item }));
  }

  return entries.map((candidate: any, index) => {
    const template = fallback[index] ?? fallbackList[Math.min(index, fallbackList.length - 1)];

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

export default function RemedialTabContent({ level, config }: RemedialTabContentProps) {
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

  const remedials = remedialsByLevel[levelConfig.label] ?? [];

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
        <p className="text-gray-600 text-md font-medium">Total: {remedials.length}</p>
        <div className="flex gap-2" />
      </div>
      {validationError && <p className="text-sm text-red-600 mb-3">{validationError}</p>}

      <ScheduledRemedialList
        remedials={remedials}
        showPlayButton={showPlayButton}
        playPath={playPath}
        allowSeeAll={levelConfig.allowSeeAll}
        allowFlashcardEdit={levelConfig.allowFlashcardEdit}
        inlineEditable={levelConfig.inlineEditable}
        editingId={editingId}
        draft={draft}
        onStartEdit={startEdit}
        onCancelEdit={cancelEdit}
        onUpdateDraft={updateDraft}
        onSave={handleSave}
        onOpenFlashcardEdit={() => setIsEditModalOpen(true)}
      />

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
