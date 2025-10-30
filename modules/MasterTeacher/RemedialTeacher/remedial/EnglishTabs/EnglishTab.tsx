"use client";
import { useEffect, useRef, useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import TableList from "@/components/Common/Tables/TableList";
import EditContentModal from "../Modals/EditContentModal";

export const ENGLISH_LEVELS = [
  "Non Reader",
  "Syllable",
  "Word",
  "Phrase",
  "Sentence",
  "Paragraph",
] as const;

export type EnglishLevel = (typeof ENGLISH_LEVELS)[number];

interface EnglishRemedial {
  id: number;
  title: string;
  phonemic: string;
  dateToUse: string;
}

const INITIAL_REMEDIALS: Record<EnglishLevel, EnglishRemedial[]> = {
  "Non Reader": [
    {
      id: 1,
      title: "Lesson 1 - Consonant",
      phonemic: "Non-Reader",
      dateToUse: "2024-06-01",
    },
    {
      id: 2,
      title: "Lesson 2 - Vowel",
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
const STORAGE_KEY = "MASTER_TEACHER_REMEDIAL_ENGLISH";
const FLASHCARDS_STORAGE_KEY = "MASTER_TEACHER_ENGLISH_FLASHCARDS";

// Define flashcard type
interface FlashcardContent {
  sentence: string;
  highlights: string[];
}

// Initial flashcards data
const INITIAL_FLASHCARDS: FlashcardContent[] = [
  { sentence: "The cat sat on the mat.", highlights: ["cat", "sat", "mat"] },
  { sentence: "A big dog ran in the park.", highlights: ["big", "dog", "ran"] },
  { sentence: "She has a red ball and blue car.", highlights: ["red", "ball", "blue"] },
  { sentence: "We go to the store for milk.", highlights: ["go", "store", "milk"] },
  { sentence: "He can see the sun in the sky.", highlights: ["see", "sun", "sky"] },
  { sentence: "I like to play with my friends.", highlights: ["like", "play", "friends"] },
  { sentence: "The book is on the small table.", highlights: ["book", "small", "table"] },
  { sentence: "They eat lunch at twelve o'clock.", highlights: ["eat", "lunch", "twelve"] },
  { sentence: "My mother reads me a story.", highlights: ["mother", "reads", "story"] },
  { sentence: "We live in a green house.", highlights: ["live", "green", "house"] },
];

type EnglishRemedialsByLevel = Record<EnglishLevel, EnglishRemedial[]>;

function cloneInitialRemedials(): EnglishRemedialsByLevel {
  return ENGLISH_LEVELS.reduce((acc, level) => {
    acc[level] = INITIAL_REMEDIALS[level].map((item) => ({ ...item }));
    return acc;
  }, {} as EnglishRemedialsByLevel);
}

function normalizeEnglishEntries(entries: EnglishRemedial[] | undefined, fallback: EnglishRemedial[]): EnglishRemedial[] {
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

function readStoredEnglishRemedials(): EnglishRemedialsByLevel | null {
  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  if (!storedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedValue) as Partial<Record<EnglishLevel, EnglishRemedial[]>>;
    return ENGLISH_LEVELS.reduce((acc, level) => {
      const normalized = normalizeEnglishEntries(parsed?.[level], INITIAL_REMEDIALS[level]);
      acc[level] = normalized;
      return acc;
    }, {} as EnglishRemedialsByLevel);
  } catch {
    return null;
  }
}

// Function to read stored flashcards
function readStoredFlashcards(): FlashcardContent[] {
  if (typeof window === "undefined") return INITIAL_FLASHCARDS;
  
  const storedValue = window.localStorage.getItem(FLASHCARDS_STORAGE_KEY);
  if (!storedValue) {
    // Initialize with default data if nothing exists
    window.localStorage.setItem(FLASHCARDS_STORAGE_KEY, JSON.stringify(INITIAL_FLASHCARDS));
    return INITIAL_FLASHCARDS;
  }

  try {
    const parsed = JSON.parse(storedValue) as FlashcardContent[];
    return Array.isArray(parsed) ? parsed : INITIAL_FLASHCARDS;
  } catch {
    return INITIAL_FLASHCARDS;
  }
}

const formatDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

interface EnglishTabProps {
  level: EnglishLevel;
}

export default function EnglishTab({ level }: EnglishTabProps) {
  const hasLoadedFromStorage = useRef(false);
  const [remedialsByLevel, setRemedialsByLevel] = useState<EnglishRemedialsByLevel>(() => cloneInitialRemedials());
  const [flashcards, setFlashcards] = useState<FlashcardContent[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EnglishRemedial | null>(null);
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

    const stored = readStoredEnglishRemedials();
    if (stored) {
      setRemedialsByLevel(stored);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cloneInitialRemedials()));
    }

    // Load flashcards
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

  const updateDraft = <K extends keyof EnglishRemedial>(key: K, value: EnglishRemedial[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = () => {
    if (!draft) return;

    const trimmedTitle = draft.title.trim();
    const trimmedPhonemic = draft.phonemic.trim();
    const dateValue = draft.dateToUse.trim();

    if (!trimmedTitle || !trimmedPhonemic || !dateValue) {
      setValidationError("Please complete all fields before saving.");
      return;
    }

    const updated: EnglishRemedial = {
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

  // Function to handle saving edited flashcards
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
            {level === "Non Reader" ? (
              <>
                <a href={`/MasterTeacher/RemedialTeacher/remedial/EnglishFlashcards?start=${row.startIndex}`}>
                  <UtilityButton small>Play</UtilityButton>
                </a>
                <UtilityButton
                  small
                  className="bg-[#013300] hover:bg-green-900"
                  onClick={() => setIsEditModalOpen(true)}
                >
                  Edit
                </UtilityButton>
              </>
            ) : (
              <>
                <UtilityButton small>See All</UtilityButton>
                {editingId === row.id ? (
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
          </>
        )}
        pageSize={10}
      />

      {/* Edit Content Modal */}
      <EditContentModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        flashcards={flashcards}
        onSave={handleSaveFlashcards}
      />
    </div>
  );
}