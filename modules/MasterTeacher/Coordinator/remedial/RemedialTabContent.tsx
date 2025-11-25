"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import TableList from "@/components/Common/Tables/TableList";
import EditContentModal, { type FlashcardContent } from "./Modals/EditContentModal";

export type RemedialEntry = {
  id: number;
  title: string;
  phonemic: string;
  dateToUse: string;
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
  const fallbackList = fallback.length > 0 ? fallback : [{ id: 0, title: "", phonemic: "", dateToUse: "" }];

  if (!Array.isArray(entries) || entries.length === 0) {
    return fallbackList.map((item) => ({ ...item }));
  }

  return entries.map((candidate: any, index) => {
    const template = fallback[index] ?? fallbackList[Math.min(index, fallbackList.length - 1)];

    return {
      id: typeof candidate?.id === "number" ? candidate.id : template.id,
      title:
        typeof candidate?.title === "string" && candidate.title.trim() ? candidate.title : template.title,
      phonemic:
        typeof candidate?.phonemic === "string" && candidate.phonemic.trim()
          ? candidate.phonemic
          : template.phonemic,
      dateToUse:
        typeof candidate?.dateToUse === "string" && candidate.dateToUse.trim()
          ? candidate.dateToUse
          : template.dateToUse,
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
    const trimmedPhonemic = draft.phonemic.trim();
    const trimmedDate = draft.dateToUse.trim();

    if (!trimmedTitle || !trimmedPhonemic || !trimmedDate) {
      setValidationError(validationMessage);
      return;
    }

    const updated: RemedialEntry = {
      id: draft.id,
      title: trimmedTitle,
      phonemic: trimmedPhonemic,
      dateToUse: trimmedDate,
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

      <TableList
        columns={[
          { key: "no", title: "No#" },
          {
            key: "title",
            title: "Title",
            render: (row: any) =>
              levelConfig.inlineEditable && editingId === row.id && draft ? (
                <input
                  value={draft.title}
                  onChange={(event) => updateDraft("title", event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                />
              ) : (
                row.title
              ),
          },
          {
            key: "phonemic",
            title: "Phonemic",
            render: (row: any) =>
              levelConfig.inlineEditable && editingId === row.id && draft ? (
                <input
                  value={draft.phonemic}
                  onChange={(event) => updateDraft("phonemic", event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                />
              ) : (
                row.phonemic
              ),
          },
          {
            key: "dateToUse",
            title: "Date to use",
            render: (row: any) =>
              levelConfig.inlineEditable && editingId === row.id && draft ? (
                <input
                  type="date"
                  value={draft.dateToUse}
                  onChange={(event) => updateDraft("dateToUse", event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                />
              ) : (
                formatDate(row.dateToUse)
              ),
          },
        ]}
        data={rows}
        actions={(row: any) => (
          <>
            {showPlayButton && (
              <a href={`${playPath}?start=${row.startIndex}`}>
                <UtilityButton small title="Click to play remedial session">Play</UtilityButton>
              </a>
            )}
            {levelConfig.allowSeeAll && <UtilityButton small>See All</UtilityButton>}
            {levelConfig.allowFlashcardEdit && (
              <UtilityButton
                small
                className="bg-[#013300] hover:bg-green-900"
                onClick={() => setIsEditModalOpen(true)}
              >
                Edit
              </UtilityButton>
            )}
            {levelConfig.inlineEditable && (
              editingId === row.id ? (
                <>
                  <UtilityButton small onClick={handleSave}>
                    Save
                  </UtilityButton>
                  <UtilityButton
                    small
                    className="bg-white text-[#013300] border-[#013300] hover:bg-gray-100"
                    onClick={cancelEdit}
                  >
                    Cancel
                  </UtilityButton>
                </>
              ) : (
                <UtilityButton small onClick={() => startEdit(row.id)}>
                  Edit
                </UtilityButton>
              )
            )}
          </>
        )}
        pageSize={10}
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
