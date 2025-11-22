"use client";
import { useEffect, useState } from "react";
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
  const [remedialsByLevel, setRemedialsByLevel] = useState<MathRemedialsByLevel>(() => cloneInitialRemedials());

  const remedials = remedialsByLevel[level] ?? [];

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = readStoredMathRemedials();
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
            <a href={`/Teacher/remedial/MathFlashcards?start=${row.startIndex}`}>
              <UtilityButton small>Play</UtilityButton>
            </a>
          </>
        )}
        pageSize={10}
      />
    </div>
  );
}
