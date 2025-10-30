"use client";
import { useEffect, useRef, useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import TableList from "@/components/Common/Tables/TableList";
import EditContentModal, { type FlashcardContent } from "../Modals/EditContentModal";

export const FILIPINO_LEVELS = [
  "Non Reader",
  "Syllable",
  "Word",
  "Phrase",
  "Sentence",
  "Paragraph",
] as const;

export type FilipinoLevel = (typeof FILIPINO_LEVELS)[number];

interface FilipinoRemedial {
  id: number;
  title: string;
  phonemic: string;
  dateToUse: string;
}

const INITIAL_REMEDIALS: Record<FilipinoLevel, FilipinoRemedial[]> = {
  "Non Reader": [
    {
      id: 1,
      title: "Aralin 1 - Katinig",
      phonemic: "Non-Reader",
      dateToUse: "2024-06-01",
    },
    {
      id: 2,
      title: "Aralin 2 - Patinig",
      phonemic: "Non-Reader",
      dateToUse: "2024-06-02",
    },
  ],
  Syllable: [],
  Word: [],
  Phrase: [],
  Sentence: [],
  Paragraph: [],
};
const STORAGE_KEY = "MASTER_TEACHER_REMEDIAL_FILIPINO";
const FLASHCARDS_STORAGE_KEY = "MASTER_TEACHER_FILIPINO_FLASHCARDS";

const INITIAL_FLASHCARDS: FlashcardContent[] = [
  { sentence: "Ang bata ay naglalaro sa parke.", highlights: ["bata", "parke"] },
  { sentence: "Kumakain ng masarap na pagkain ang pamilya.", highlights: ["masarap", "pamilya"] },
  { sentence: "Maganda ang bulaklak sa hardin.", highlights: ["bulaklak", "hardin"] },
  { sentence: "Mabilis tumakbo ang maliit na aso.", highlights: ["mabilis", "aso"] },
  { sentence: "Malakas ang ulan kanina.", highlights: ["malakas", "ulan"] },
  { sentence: "Nagluluto ang nanay ng hapunan.", highlights: ["nanay", "hapunan"] },
  { sentence: "Mabait ang guro sa eskwelahan.", highlights: ["guro", "eskwelahan"] },
  { sentence: "Maliwanag ang buwan ngayong gabi.", highlights: ["buwan", "gabi"] },
  { sentence: "Matulungin ang batang lalaki.", highlights: ["matulungin", "batang"] },
  { sentence: "Masaya ang mga bata sa party.", highlights: ["masaya", "party"] },
];

function isValidFlashcardContent(value: unknown): value is FlashcardContent[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as { sentence?: unknown; highlights?: unknown };
    if (typeof candidate.sentence !== "string") return false;
    if (!Array.isArray(candidate.highlights)) return false;
    return candidate.highlights.every((word) => typeof word === "string");
  });
}

function readStoredFlashcards(): FlashcardContent[] {
  if (typeof window === "undefined") return INITIAL_FLASHCARDS;

  const storedValue = window.localStorage.getItem(FLASHCARDS_STORAGE_KEY);
  if (!storedValue) {
    window.localStorage.setItem(FLASHCARDS_STORAGE_KEY, JSON.stringify(INITIAL_FLASHCARDS));
    return INITIAL_FLASHCARDS;
  }

  try {
    const parsed = JSON.parse(storedValue);
    if (isValidFlashcardContent(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.warn("Failed to parse Filipino flashcards", error);
  }

  window.localStorage.setItem(FLASHCARDS_STORAGE_KEY, JSON.stringify(INITIAL_FLASHCARDS));
  return INITIAL_FLASHCARDS;
}

type FilipinoRemedialsByLevel = Record<FilipinoLevel, FilipinoRemedial[]>;

function cloneInitialRemedials(): FilipinoRemedialsByLevel {
  return FILIPINO_LEVELS.reduce((acc, level) => {
    acc[level] = INITIAL_REMEDIALS[level].map((item) => ({ ...item }));
    return acc;
  }, {} as FilipinoRemedialsByLevel);
}

function normalizeFilipinoEntries(entries: FilipinoRemedial[] | undefined, fallback: FilipinoRemedial[]): FilipinoRemedial[] {
  const fallbackList = fallback.length > 0 ? fallback : [{ id: 0, title: "", phonemic: "", dateToUse: "" }];

  if (!Array.isArray(entries) || entries.length === 0) {
    return fallbackList.map((item) => ({ ...item }));
  }

  return entries.map((item: any, index) => {
    const template = fallback[index] ?? fallbackList[Math.min(index, fallbackList.length - 1)];

    return {
      id: typeof item?.id === "number" ? item.id : template.id,
      title: typeof item?.title === "string" && item.title.trim() ? item.title : template.title,
      phonemic: typeof item?.phonemic === "string" && item.phonemic.trim() ? item.phonemic : template.phonemic,
      dateToUse: typeof item?.dateToUse === "string" && item.dateToUse.trim() ? item.dateToUse : template.dateToUse,
    };
  });
}

function readStoredFilipinoRemedials(): FilipinoRemedialsByLevel | null {
  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  if (!storedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedValue) as Partial<Record<FilipinoLevel, FilipinoRemedial[]>>;
    return FILIPINO_LEVELS.reduce((acc, level) => {
      const normalized = normalizeFilipinoEntries(parsed?.[level], INITIAL_REMEDIALS[level]);
      acc[level] = normalized;
      return acc;
    }, {} as FilipinoRemedialsByLevel);
  } catch {
    return null;
  }
}

const formatDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

interface FilipinoTabProps {
  level: FilipinoLevel;
}

export default function FilipinoTab({ level }: FilipinoTabProps) {
  const hasLoadedFromStorage = useRef(false);
  const [remedialsByLevel, setRemedialsByLevel] = useState<FilipinoRemedialsByLevel>(() => cloneInitialRemedials());
  const [flashcards, setFlashcards] = useState<FlashcardContent[]>(INITIAL_FLASHCARDS);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<FilipinoRemedial | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const remedials = remedialsByLevel[level] ?? [];

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasLoadedFromStorage.current) return;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remedialsByLevel));
  }, [remedialsByLevel]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = readStoredFilipinoRemedials();
    if (stored) {
      setRemedialsByLevel(stored);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cloneInitialRemedials()));
    }

    const storedFlashcards = readStoredFlashcards();
    setFlashcards(storedFlashcards);

    hasLoadedFromStorage.current = true;
  }, []);

  useEffect(() => {
    setEditingId(null);
    setDraft(null);
    setValidationError(null);
  }, [level]);

  const startEdit = (id: number) => {
    if (level === "Non Reader") return;
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

  const updateDraft = <K extends keyof FilipinoRemedial>(key: K, value: FilipinoRemedial[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = () => {
    if (!draft) return;

    const trimmedTitle = draft.title.trim();
    const trimmedPhonemic = draft.phonemic.trim();
    const dateValue = draft.dateToUse.trim();

    if (!trimmedTitle || !trimmedPhonemic || !dateValue) {
      setValidationError("Pakipunan ang lahat ng detalye bago mag-save.");
      return;
    }

    const updated: FilipinoRemedial = {
      id: draft.id,
      title: trimmedTitle,
      phonemic: trimmedPhonemic,
      dateToUse: dateValue,
    };

    setRemedialsByLevel((prev) => ({
      ...prev,
      [level]: prev[level].map((item) => (item.id === draft.id ? updated : item)),
    }));

    cancelEdit();
  };

  const handleSaveFlashcards = (updatedFlashcards: FlashcardContent[]) => {
    setFlashcards(updatedFlashcards);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(FLASHCARDS_STORAGE_KEY, JSON.stringify(updatedFlashcards));
    }
    setIsEditModalOpen(false);
  };

  const rows = remedials.map((remedial, index) => ({
    ...remedial,
    no: index + 1,
    startIndex: index,
  }));

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
              editingId === row.id && draft ? (
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
              editingId === row.id && draft ? (
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
              editingId === row.id && draft ? (
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
            <a href={`/MasterTeacher/RemedialTeacher/remedial/FilipinoFlashcards?start=${row.startIndex}`}>
              <UtilityButton small>Play</UtilityButton>
            </a>
            {level === "Non Reader" ? (
              <UtilityButton
                small
                className="bg-[#013300] hover:bg-green-900"
                onClick={() => setIsEditModalOpen(true)}
              >
                Edit
              </UtilityButton>
            ) : editingId === row.id ? (
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
            )}
          </>
        )}
        pageSize={10}
      />

      <EditContentModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        flashcards={flashcards}
        onSave={handleSaveFlashcards}
      />
    </div>
  );
}
