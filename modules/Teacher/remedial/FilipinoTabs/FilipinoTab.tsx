"use client";
import { useEffect, useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import TableList from "@/components/Common/Tables/TableList";

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
  const [remedialsByLevel, setRemedialsByLevel] = useState<FilipinoRemedialsByLevel>(() => cloneInitialRemedials());

  const remedials = remedialsByLevel[level] ?? [];

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = readStoredFilipinoRemedials();
    if (stored) {
      setRemedialsByLevel(stored);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cloneInitialRemedials()));
    }
  }, []);

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

      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "title", title: "Title" },
          { key: "phonemic", title: "Phonemic" },
          {
            key: "dateToUse",
            title: "Date to use",
            render: (row: any) => formatDate(row.dateToUse),
          },
        ]}
        data={rows}
        actions={(row: any) => (
          <>
            <a href={`/Teacher/remedial/FilipinoFlashcards?start=${row.startIndex}`}>
              <UtilityButton small title="Click to play remedial session">Play</UtilityButton>
            </a>
          </>
        )}
        pageSize={10}
      />
    </div>
  );
}
