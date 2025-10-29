"use client";
import { useEffect, useRef, useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import TableList from "@/components/Common/Tables/TableList";

export const MATH_LEVELS = [
  "Not Proficient",
  "Low Proficient",
  "Nearly Proficient",
  "Proficient",
  "Highly Proficient",
] as const;

export type MathLevel = (typeof MATH_LEVELS)[number];

interface MathRemedial {
  id: number;
  title: string;
  phonemic: string;
  dateToUse: string;
}

const INITIAL_REMEDIALS: Record<MathLevel, MathRemedial[]> = {
  "Not Proficient": [
    {
      id: 1,
      title: "Basic Addition & Subtraction",
      phonemic: "Not Proficient",
      dateToUse: "2024-06-01",
    },
    {
      id: 2,
      title: "Simple Multiplication",
      phonemic: "Not Proficient",
      dateToUse: "2024-06-02",
    },
    {
      id: 3,
      title: "Basic Division",
      phonemic: "Not Proficient",
      dateToUse: "2024-06-03",
    },
  ],
  "Low Proficient": [
    {
      id: 4,
      title: "Intro Fractions",
      phonemic: "Low Proficient",
      dateToUse: "2024-06-04",
    },
  ],
  "Nearly Proficient": [
    {
      id: 5,
      title: "Decimal Operations",
      phonemic: "Nearly Proficient",
      dateToUse: "2024-06-05",
    },
  ],
  Proficient: [
    {
      id: 6,
      title: "Intro Algebra",
      phonemic: "Proficient",
      dateToUse: "2024-06-06",
    },
  ],
  "Highly Proficient": [
    {
      id: 7,
      title: "Geometry Applications",
      phonemic: "Highly Proficient",
      dateToUse: "2024-06-07",
    },
  ],
};
const STORAGE_KEY = "MASTER_TEACHER_REMEDIAL_MATH";

type MathRemedialsByLevel = Record<MathLevel, MathRemedial[]>;

function cloneInitialRemedials(): MathRemedialsByLevel {
  return MATH_LEVELS.reduce((acc, level) => {
    acc[level] = INITIAL_REMEDIALS[level].map((item) => ({ ...item }));
    return acc;
  }, {} as MathRemedialsByLevel);
}

function normalizeMathEntries(entries: MathRemedial[] | undefined, fallback: MathRemedial[]): MathRemedial[] {
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

function readStoredMathRemedials(): MathRemedialsByLevel | null {
  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  if (!storedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedValue) as Partial<Record<MathLevel, MathRemedial[]>>;
    return MATH_LEVELS.reduce((acc, level) => {
      const normalized = normalizeMathEntries(parsed?.[level], INITIAL_REMEDIALS[level]);
      acc[level] = normalized.map((item, index) => ({
        ...item,
        phonemic: item.phonemic || INITIAL_REMEDIALS[level][index]?.phonemic || "",
      }));
      return acc;
    }, {} as MathRemedialsByLevel);
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

interface MathTabProps {
  level: MathLevel;
}

export default function MathTab({ level }: MathTabProps) {
  const hasLoadedFromStorage = useRef(false);
  const [remedialsByLevel, setRemedialsByLevel] = useState<MathRemedialsByLevel>(() => cloneInitialRemedials());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<MathRemedial | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const remedials = remedialsByLevel[level] ?? [];

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasLoadedFromStorage.current) return;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remedialsByLevel));
  }, [remedialsByLevel]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = readStoredMathRemedials();
    if (stored) {
      setRemedialsByLevel(stored);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cloneInitialRemedials()));
    }

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

  const updateDraft = <K extends keyof MathRemedial>(key: K, value: MathRemedial[K]) => {
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

    const updated: MathRemedial = {
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
            <a href={`/MasterTeacher/RemedialTeacher/remedial/MathFlashcards?start=${row.startIndex}`}>
              <UtilityButton small>Play</UtilityButton>
            </a>
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
        pageSize={10}
      />
    </div>
  );
}
