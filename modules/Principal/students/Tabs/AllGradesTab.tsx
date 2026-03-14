import { useState, useRef, useEffect, useMemo } from "react";
import StudentDetailModal from "../Modals/StudentDetailModal";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import TableList from "@/components/Common/Tables/TableList";
import SortMenu, { type SortMenuItem } from "@/components/Common/Menus/SortMenu";

const sections = ["All Sections", "A", "B", "C"];

interface AllGradesTabProps {
  students: any[];
  setStudents: (students: any[]) => void;
  searchTerm: string;
  gradeFilter?: string;
}

interface CustomDropdownProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const CustomDropdown = ({ options, value, onChange, className = "" }: CustomDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOptionClick = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };


  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        className="flex items-center justify-between px-3 py-1.5 text-sm font-medium text-gray-700 cursor-pointer focus:outline-none border border-gray-300 rounded bg-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        {value}
        <svg 
          className={`ml-2 h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 bg-white border border-gray-300 rounded-md shadow-lg w-full overflow-hidden">
          {options.map((option) => (
            <div
              key={option}
              className={`px-4 py-2 cursor-pointer transition-colors ${
                option === value
                  ? "bg-[#013300] text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
              onClick={() => handleOptionClick(option)}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const extractGradeNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const match = value.match(/(\d+)/);
    if (match) {
      return Number(match[1]);
    }
  }
  return null;
};

type StudentSortKey =
  | "name_asc"
  | "name_desc"
  | "lrn_asc"
  | "lrn_desc"
  | "phonemic_low_high"
  | "phonemic_high_low";

const DEFAULT_STUDENT_SORT: StudentSortKey = "name_asc";

const STUDENT_SORT_ITEMS: SortMenuItem<StudentSortKey>[] = [
  { value: "name_asc", label: "Name (A-Z)" },
  { value: "name_desc", label: "Name (Z-A)" },
  { type: "separator", id: "name-lrn" },
  { value: "lrn_asc", label: "LRN (Asc)" },
  { value: "lrn_desc", label: "LRN (Desc)" },
  { type: "separator", id: "lrn-phonemic" },
  { value: "phonemic_low_high", label: "Phonemic Level (Low->High)" },
  { value: "phonemic_high_low", label: "Phonemic Level (High->Low)" },
];

const PHONEMIC_LEVELS_ENGLISH = ["Non-Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"];
const PHONEMIC_LEVELS_MATH = ["Not Proficient", "Low Proficient", "Nearly Proficient", "Proficient", "Highly Proficient"];

const normalizePhonemic = (value: unknown): string => String(value ?? "").trim().toLowerCase();
const normalizeLrn = (lrn?: string | null): string | null => {
  if (!lrn) return null;
  const digits = lrn.replace(/\D/g, "").slice(0, 12);
  if (digits.length !== 12) return null;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
};

const maskLrnForDisplay = (lrn?: string | null): string => {
  const normalized = normalizeLrn(lrn);
  if (!normalized) return "N/A";
  const digits = normalized.replace(/\D/g, "");
  return `${digits.slice(0, 2)}****-****${digits.slice(-2)}`;
};

const getStudentPhonemicValue = (student: any): string =>
  String(
    student?.englishPhonemic ??
      student?.english_phonemic ??
      student?.english ??
      student?.filipinoPhonemic ??
      student?.filipino_phonemic ??
      student?.filipino ??
      student?.mathProficiency ??
      student?.math_proficiency ??
      student?.math ??
      "",
  ).trim();

export default function AllGradesTab({ students, searchTerm, gradeFilter = "All Grades" }: AllGradesTabProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [sortBy, setSortBy] = useState<StudentSortKey>(DEFAULT_STUDENT_SORT);
  const [visibleLrnIds, setVisibleLrnIds] = useState<Set<string>>(new Set());
  const lrnRevealTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    return () => {
      Object.values(lrnRevealTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
      lrnRevealTimersRef.current = {};
    };
  }, []);

  const normalizedGradeFilter = gradeFilter === "All Grades" ? null : extractGradeNumber(gradeFilter);

  const gradeFilteredStudents = students.filter((student) => {
    if (!normalizedGradeFilter) {
      return true;
    }
    const studentGrade = extractGradeNumber(student?.grade ?? student?.grade_level ?? student?.gradeLevel);
    return studentGrade === normalizedGradeFilter;
  });

  const filteredStudents = gradeFilteredStudents.filter((student) => {
    const matchSearch = searchTerm === "" || 
      student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(student.lrn ?? "").toLowerCase().includes(searchTerm.toLowerCase());
      
    return matchSearch;
  });

  const phonemicOrder = useMemo(() => {
    const order = new Map<string, number>();
    [...PHONEMIC_LEVELS_ENGLISH, ...PHONEMIC_LEVELS_MATH].forEach((level, index) => {
      const key = normalizePhonemic(level);
      if (!order.has(key)) {
        order.set(key, index);
      }
    });
    return order;
  }, []);

  const sortedStudents = useMemo(() => {
    const fallbackIndex = phonemicOrder.size + 1;
    const compareName = (a: any, b: any): number =>
      String(a?.name ?? "").localeCompare(String(b?.name ?? ""), undefined, { sensitivity: "base" });
    const normalizeSortableLrn = (student: any): string | null => {
      const raw = String(student?.lrn ?? "").replace(/\D/g, "");
      return raw.length > 0 ? raw : null;
    };

    return [...filteredStudents].sort((a, b) => {
      if (sortBy === "name_asc") {
        return compareName(a, b);
      }
      if (sortBy === "name_desc") {
        return compareName(b, a);
      }

      if (sortBy === "lrn_asc" || sortBy === "lrn_desc") {
        const aLrn = normalizeSortableLrn(a);
        const bLrn = normalizeSortableLrn(b);
        if (aLrn && bLrn && aLrn !== bLrn) {
          return sortBy === "lrn_asc" ? aLrn.localeCompare(bLrn) : bLrn.localeCompare(aLrn);
        }
        if (aLrn && !bLrn) return -1;
        if (!aLrn && bLrn) return 1;
        return compareName(a, b);
      }

      const aIndex = phonemicOrder.get(normalizePhonemic(getStudentPhonemicValue(a))) ?? fallbackIndex;
      const bIndex = phonemicOrder.get(normalizePhonemic(getStudentPhonemicValue(b))) ?? fallbackIndex;
      if (aIndex !== bIndex) {
        return sortBy === "phonemic_low_high" ? aIndex - bIndex : bIndex - aIndex;
      }
      return compareName(a, b);
    });
  }, [filteredStudents, phonemicOrder, sortBy]);

  const hasActiveSort = sortBy !== DEFAULT_STUDENT_SORT;
  const handleClearAll = () => {
    setSortBy(DEFAULT_STUDENT_SORT);
  };

  const handleViewDetails = (student: any) => {
    setSelectedStudent(student);
    setShowDetailModal(true);
  };

  const handleRevealLrn = (rowId: string) => {
    if (!rowId) return;

    setVisibleLrnIds((prev) => {
      const next = new Set(prev);
      next.add(rowId);
      return next;
    });

    const existingTimer = lrnRevealTimersRef.current[rowId];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    lrnRevealTimersRef.current[rowId] = window.setTimeout(() => {
      setVisibleLrnIds((prev) => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
      delete lrnRevealTimersRef.current[rowId];
    }, 3000);
  };

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4">
        <p className="text-gray-700 text-md font-medium">
          Total: {sortedStudents.length}
        </p>
        <SortMenu
          small
          iconOnly
          align="right"
          value={sortBy}
          items={STUDENT_SORT_ITEMS}
          onChange={setSortBy}
          onClearAll={handleClearAll}
          clearAllDisabled={!hasActiveSort}
          buttonAriaLabel="Open sort options"
        />
      </div>

      <StudentDetailModal
        show={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        student={selectedStudent}
      />

      <TableList
        showFullScreenToggle
        columns={[
          { key: "no", title: "No#" },
          {
            key: "maskedLrn",
            title: "LRN",
            render: (row: any) => {
              const rowId = String(row.id ?? row.studentId ?? "");
              const isVisible = rowId ? visibleLrnIds.has(rowId) : false;
              const displayValue = isVisible ? (row.fullLrn ?? "N/A") : (row.maskedLrn ?? "N/A");
              const canReveal = Boolean(row.fullLrn && row.fullLrn !== "N/A");

              return (
                <div className="inline-flex items-center gap-2">
                  <span>{displayValue}</span>
                  {canReveal && (
                    <button
                      type="button"
                      onClick={() => handleRevealLrn(rowId)}
                      className="inline-flex items-center justify-center rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-[#013300]"
                      title="Show full LRN for 3 seconds"
                      aria-label="Show full LRN for 3 seconds"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
                        />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            },
          },
          { key: "name", title: "Full Name" },
          { key: "grade", title: "Grade" },
          { key: "phonemic", title: "Phonemic" },
        ]}
        data={sortedStudents.map((student: any, idx: number) => ({
          ...student,
          no: idx + 1,
          fullLrn: normalizeLrn(student.lrn) ?? "N/A",
          maskedLrn: maskLrnForDisplay(student.lrn),
          phonemic: getStudentPhonemicValue(student),
        }))}
        actions={(row: any) => (
          <UtilityButton small onClick={() => handleViewDetails(row)}>
            View
          </UtilityButton>
        )}
        pageSize={10}
      />
    </div>
  );
}
