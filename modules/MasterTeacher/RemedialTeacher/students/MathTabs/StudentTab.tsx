import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import * as XLSX from 'xlsx';
import AddStudentModal from "../Modals/AddStudentModal";
import StudentDetailModal from "../Modals/StudentDetailModal";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
import DeleteConfirmationModal from "@/components/Common/Modals/DeleteConfirmationModal";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";
import KebabMenu from "@/components/Common/Menus/KebabMenu";
import SortMenu, { type SortMenuItem } from "@/components/Common/Menus/SortMenu";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
import BodyLabel from "@/components/Common/Texts/BodyLabel";
import ToastActivity from "@/components/ToastActivity";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import { resolveRemedialPlayTarget } from "@/lib/utils/remedial-play";

const ALL_PHONEMIC = "All Levels";
const PHONEMIC_LEVELS = ["Not Proficient", "Low Proficient", "Nearly Proficient", "Proficient", "Highly Proficient"];

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

const normalizePhonemic = (value: string) => value.trim().toLowerCase();
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

// Define types for name parts
type NameParts = {
  firstName: string;
  lastName: string;
  middleNames: string[];
  suffix: string;
};

const KNOWN_SUFFIXES = new Set([
  "jr",
  "jr.",
  "sr",
  "sr.",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "vii",
  "viii",
  "ix",
  "x",
]);

// Helper function to capitalize words
const capitalizeWord = (value: string) => {
  if (!value) {
    return "";
  }
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const formatSuffix = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (lower === "jr" || lower === "jr.") return "Jr.";
  if (lower === "sr" || lower === "sr.") return "Sr.";
  if (KNOWN_SUFFIXES.has(lower)) return trimmed.toUpperCase();
  return trimmed;
};

// Extract name parts from student object
const extractNameParts = (student: any): NameParts => {
  const firstName = (student?.firstName ?? student?.firstname ?? "").trim();
  const lastName = (student?.lastName ?? student?.surname ?? student?.lastname ?? "").trim();
  const middleNameRaw = (student?.middleName ?? student?.middlename ?? student?.middleInitial ?? "").trim();
  const suffixRaw = (student?.suffix ?? student?.nameSuffix ?? "").trim();

  // If we have separate name fields, use them
  if (firstName || lastName) {
    const middleNames = middleNameRaw ? middleNameRaw.split(/\s+/).filter(Boolean) : [];
    return { firstName, lastName, middleNames, suffix: suffixRaw };
  }

  // Otherwise, parse the full name
  const raw = (student?.name ?? "").trim();
  if (!raw) {
    return { firstName: "", lastName: "", middleNames: [], suffix: "" };
  }

  const commaParts = raw.split(",").map((part: string) => part.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const lastName = commaParts[0];
    const firstAndMiddle = commaParts[1] ?? "";
    const firstParts = firstAndMiddle.split(/\s+/).filter(Boolean);
    const firstName = firstParts[0] ?? "";
    const middleFromFirst = firstParts.slice(1);
    let suffixFromComma = "";
    let middleFromCommaParts: string[] = [];
    if (commaParts.length > 2) {
      const possibleSuffix = commaParts[commaParts.length - 1];
      if (KNOWN_SUFFIXES.has(possibleSuffix.toLowerCase())) {
        suffixFromComma = possibleSuffix;
        middleFromCommaParts = commaParts.slice(2, -1);
      } else {
        middleFromCommaParts = commaParts.slice(2);
      }
    }
    const middleFromComma = middleFromCommaParts.join(" ").split(/\s+/).filter(Boolean);
    const suffix = suffixRaw || suffixFromComma;
    return {
      firstName,
      lastName,
      middleNames: [...middleFromFirst, ...middleFromComma],
      suffix,
    };
  }

  const parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return { firstName: "", lastName: "", middleNames: [], suffix: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "", middleNames: [], suffix: "" };
  }

  const suffixCandidate = parts[parts.length - 1];
  const suffix = !suffixRaw && KNOWN_SUFFIXES.has(suffixCandidate.toLowerCase())
    ? suffixCandidate
    : suffixRaw;
  const nameParts = suffix ? parts.slice(0, -1) : parts;
  if (nameParts.length < 2) {
    return { firstName: parts[0], lastName: "", middleNames: [], suffix };
  }

  // Assume format: FirstName MiddleName LastName
  return {
    firstName: nameParts[0],
    lastName: nameParts[nameParts.length - 1],
    middleNames: nameParts.slice(1, -1),
    suffix,
  };
};

// Format display name as "Surname, FirstName M.I."
const formatStudentDisplayName = (student: any) => {
  const { firstName, lastName, middleNames, suffix } = extractNameParts(student);
  
  if (!firstName && !lastName) {
    return student?.name ?? "";
  }
  
  const segments: string[] = [];
  
  // Add last name (surname) first
  if (lastName) {
    segments.push(capitalizeWord(lastName));
  }
  
  // Add first name
  if (firstName) {
    segments.push(capitalizeWord(firstName));
  }
  
  // Add middle initials
  const middleInitials = middleNames
    .map((name) => (name ? `${name.charAt(0).toUpperCase()}.` : ""))
    .filter(Boolean)
    .join(" ");
  
  if (middleInitials) {
    segments.push(middleInitials);
  }
  
  const formattedSuffix = formatSuffix(suffix);

  // Format as "Surname, FirstName M.I., Suffix"
  if (segments.length === 1) {
    return segments[0];
  } else if (segments.length === 2) {
    return `${segments[0]}, ${segments[1]}${formattedSuffix ? `, ${formattedSuffix}` : ""}`;
  } else {
    const core = `${segments[0]}, ${segments[1]} ${segments.slice(2).join(" ")}`;
    return `${core}${formattedSuffix ? `, ${formattedSuffix}` : ""}`;
  }
};

// Build sort key for A-Z sorting by Surname, FirstName, Middle Initials
const buildNameSortKey = (student: any) => {
  const { firstName, lastName, middleNames, suffix } = extractNameParts(student);
  
  // Create sort key: lastName|firstName|middleNames
  const normalized = [
    lastName.toLowerCase(),
    firstName.toLowerCase(),
    middleNames.join(" ").toLowerCase(),
    suffix.toLowerCase(),
  ].join("|");
  
  // If we have no name data, use the raw name field
  if (normalized.replace(/\|/g, "").trim()) {
    return normalized;
  }
  
  return (student?.name ?? "").toLowerCase();
};

const ExportIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14" />
  </svg>
);

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
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        className="flex items-center justify-between px-3 py-1.5 text-sm font-medium text-gray-700 cursor-pointer focus:outline-none border border-gray-300 rounded bg-white whitespace-nowrap"
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
        <div className="absolute z-50 mt-1 right-0 left-auto bg-white border border-gray-300 rounded-md shadow-lg min-w-full w-max overflow-hidden">
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

interface StudentTabProps {
  students: any[];
  setStudents: React.Dispatch<React.SetStateAction<any[]>>;
  searchTerm: string;
}

export default function StudentTab({ students, setStudents, searchTerm }: StudentTabProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [filter, setFilter] = useState({ phonemic: ALL_PHONEMIC });
  const [sortBy, setSortBy] = useState<StudentSortKey>(DEFAULT_STUDENT_SORT);
  const [visibleLrnIds, setVisibleLrnIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lrnRevealTimersRef = useRef<Record<string, number>>({});
  const [playLoadingId, setPlayLoadingId] = useState<string | null>(null);
  const [promoteLoadingId, setPromoteLoadingId] = useState<string | null>(null);
  const [promotionRecommendationRefreshKey, setPromotionRecommendationRefreshKey] = useState(0);
  const [statusToast, setStatusToast] = useState<{
    title: string;
    message: string;
    tone: "success" | "error" | "info";
  } | null>(null);

  const userProfile = useMemo(() => getStoredUserProfile(), []);
  const userId = useMemo(() => {
    const raw = userProfile?.userId;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }, [userProfile]);

  useEffect(() => {
    if (!statusToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setStatusToast(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [statusToast]);

  useEffect(() => {
    return () => {
      Object.values(lrnRevealTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
      lrnRevealTimersRef.current = {};
    };
  }, []);
  

  // React Hook Form setup
  const formMethods = useForm({
    defaultValues: {
      studentId: "",
      name: "",
      grade: "",
      section: "",
      age: "",
      address: "",
      guardian: "",
      guardianContact: "",
      englishPhonemic: "",
      filipinoPhonemic: "",
      mathProficiency: "",
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = formMethods;

  // Add new student
  const onSubmit = (data: any) => {
    const gradeNum = Number(data.grade);
    setStudents([
      ...students,
      {
        id: Date.now(),
        ...data,
        grade: isNaN(gradeNum) ? "" : gradeNum,
      },
    ]);
    reset();
    setShowModal(false);
  };

  // Handle student selection
  const handleSelectStudent = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedStudents);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedStudents(newSelected);
  };

  // Filter students based on search term and proficiency level
  const filteredStudents = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();
    return students.filter((student) => {
      const studentPhonemic = student.mathProficiency ?? "";
      const matchPhonemic =
        filter.phonemic === ALL_PHONEMIC ||
        normalizePhonemic(studentPhonemic) === normalizePhonemic(filter.phonemic);
      
      // Search in formatted name for better matching
      const formattedName = formatStudentDisplayName(student).toLowerCase();
      const matchSearch =
        searchValue === "" ||
        formattedName.includes(searchValue) ||
        student.studentId?.toString().toLowerCase().includes(searchValue) ||
        student.grade?.toString().toLowerCase().includes(searchValue) ||
        student.section?.toLowerCase().includes(searchValue);
      
      return matchPhonemic && matchSearch;
    });
  }, [students, filter.phonemic, searchTerm]);

  const phonemicOrder = useMemo(() => {
    const order = new Map<string, number>();
    PHONEMIC_LEVELS.forEach((level, index) => {
      order.set(normalizePhonemic(level), index);
    });
    return order;
  }, []);

  const sortedStudents = useMemo(() => {
    const fallbackIndex = phonemicOrder.size + 1;
    const list = [...filteredStudents];
    const compareName = (a: any, b: any): number => {
      const aKey = buildNameSortKey(a);
      const bKey = buildNameSortKey(b);
      return aKey.localeCompare(bKey, undefined, { sensitivity: "base" });
    };
    const normalizeSortableLrn = (student: any): string | null => {
      const raw = String(student?.lrn ?? "").replace(/\D/g, "");
      return raw.length > 0 ? raw : null;
    };
    const getStudentPhonemicValue = (student: any): string =>
      String(student?.mathProficiency ?? "").trim();

    list.sort((a, b) => {
      if (sortBy === "name_asc") return compareName(a, b);
      if (sortBy === "name_desc") return compareName(b, a);

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
    return list;
  }, [filteredStudents, phonemicOrder, sortBy]);

  const hasActiveSortOrFilter = sortBy !== DEFAULT_STUDENT_SORT || filter.phonemic !== ALL_PHONEMIC;
  const handleClearAll = () => {
    setSortBy(DEFAULT_STUDENT_SORT);
    setFilter({ phonemic: ALL_PHONEMIC });
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

  const handleExport = () => {
    if (sortedStudents.length === 0) {
      setStatusToast({
        title: "Nothing to Export",
        message: "No students are available to export.",
        tone: "info",
      });
      return;
    }

    const exportData = sortedStudents.map((student, index) => {
      const row: Record<string, string | number> = {
        "No#": index + 1,
        "Student ID": student.studentId ?? "",
        "Full Name": formatStudentDisplayName(student),
        Grade: student.grade ?? "",
        Section: student.section ?? "",
        Guardian: student.guardian ?? "",
        "Guardian Contact": student.guardianContact ?? "",
        Address: student.address ?? "",
      };

      const detailColumns: Array<[string, string]> = [
        ["LRN", String(student?.lrn ?? "").trim()],
        ["First Name", String(student?.firstName ?? student?.first_name ?? student?.firstname ?? "").trim()],
        ["Middle Name", String(student?.middleName ?? student?.middle_name ?? student?.middlename ?? "").trim()],
        ["Last Name", String(student?.lastName ?? student?.last_name ?? student?.lastname ?? student?.surname ?? "").trim()],
        ["Suffix", String(student?.suffix ?? student?.suffix_name ?? student?.suf ?? "").trim()],
        [
          "Parent/Guardian First Name",
          String(student?.parentFirstName ?? student?.parent_first_name ?? student?.guardianFirstName ?? student?.guardian_first_name ?? "").trim(),
        ],
        [
          "Parent/Guardian Middle Name",
          String(student?.parentMiddleName ?? student?.parent_middle_name ?? student?.guardianMiddleName ?? student?.guardian_middle_name ?? "").trim(),
        ],
        [
          "Parent/Guardian Last Name",
          String(student?.parentLastName ?? student?.parent_last_name ?? student?.guardianLastName ?? student?.guardian_last_name ?? "").trim(),
        ],
        [
          "Parent/Guardian Suffix",
          String(student?.parentSuffix ?? student?.parent_suffix ?? student?.guardianSuffix ?? student?.guardian_suffix ?? student?.guardian_suf ?? "").trim(),
        ],
        ["Relationship to Student", String(student?.relationship ?? "").trim()],
        ["Guardian Email", String(student?.guardianEmail ?? "").trim()],
        ["English Phonemic", String(student?.englishPhonemic ?? student?.english ?? "").trim()],
        ["Filipino Phonemic", String(student?.filipinoPhonemic ?? student?.filipino ?? "").trim()],
        ["Math Proficiency", String(student?.mathProficiency ?? student?.math ?? "").trim()],
      ];

      detailColumns.forEach(([column, value]) => {
        if (!(column in row)) {
          row[column] = value;
        }
      });

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");

    const timestamp = new Date().toISOString().replace(/[:.-]/g, "");
    const filename = `MasterTeacher_Math_Students_${timestamp}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const handleExportClick = () => {
    if (sortedStudents.length === 0) {
      setStatusToast({
        title: "Nothing to Export",
        message: "No students are available to export.",
        tone: "info",
      });
      return;
    }
    handleExport();
  };

  const utilityCircleButtonClass =
    "inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100 active:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2";

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(new Set(sortedStudents.map(s => s.id)));
    } else {
      setSelectedStudents(new Set());
    }
  };

  // Handle select mode
  const handleEnterSelectMode = () => {
    setSelectMode(true);
  };

  const handleCancelSelect = () => {
    setSelectMode(false);
    setSelectedStudents(new Set());
  };

  // Delete selected students
  const handleDeleteSelected = () => {
    if (selectedStudents.size === 0) return;
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    setStudents(students.filter(s => !selectedStudents.has(s.id)));
    setSelectedStudents(new Set());
    setSelectMode(false);
    setShowDeleteModal(false);
  };

  // Handle viewing student details
  const handleViewDetails = (student: any) => {
    setSelectedStudent(student);
    setShowDetailModal(true);
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['.xlsx', '.xls'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!validTypes.includes(fileExtension)) {
      setStatusToast({
        title: "Invalid File",
        message: "Please upload only Excel files (.xlsx or .xls).",
        tone: "error",
      });
      return;
    }

    setSelectedFile(file);
    setShowConfirmModal(true);
  };

  // Handle file upload confirmation
  const handleUploadConfirm = () => {
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const newStudents = jsonData.map((row: any, index: number) => {
            const studentName = `${row.FIRSTNAME || ''} ${row.MIDDLENAME || ''} ${row.SURNAME || ''}`.trim();
            const guardianName = `${row["GUARDIAN'S FIRSTNAME"] || ''} ${row["GUARDIAN'S MIDDLENAME"] || ''} ${row["GUARDIAN'S SURNAME"] || ''}`.trim();
            return {
                id: Date.now() + index,
                studentId: row['STUDENT ID'] || '',
                name: studentName,
                grade: row.GRADE || '',
                section: row.SECTION || '',
                age: row.AGE || '',
                address: row.ADDRESS || '',
                guardian: guardianName,
                guardianContact: row['CONTACT NUMBER'] || '',
                englishPhonemic: '', // Not in the excel file
                filipinoPhonemic: '', // Not in the excel file
                mathProficiency: '', // Not in the excel file
            }
        });

        setStudents([...students, ...newStudents]);
        setStatusToast({
          title: "Import Successful",
          message: `Successfully imported ${newStudents.length} students.`,
          tone: "success",
        });
      } catch (error) {
        console.error(error);
        setStatusToast({
          title: "Import Failed",
          message: "Error reading Excel file. Please check the format and column headers.",
          tone: "error",
        });
      }
    };
    reader.readAsArrayBuffer(selectedFile);
    setSelectedFile(null);
    setShowConfirmModal(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadCancel = () => {
    setSelectedFile(null);
    setShowConfirmModal(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePlayClick = (student: any) => {
    const run = async () => {
      const studentId = student?.studentId ?? student?.id ?? "";
      if (!studentId) {
        setStatusToast({
          title: "Missing Student",
          message: "Student ID is missing.",
          tone: "error",
        });
        return;
      }

      const phonemicLevel = String(student?.mathProficiency ?? student?.math ?? "").trim();
      if (!phonemicLevel) {
        setStatusToast({
          title: "Missing Level",
          message: "Student phonemic level is missing.",
          tone: "error",
        });
        return;
      }

      setPlayLoadingId(String(studentId));
      try {
        const result = await resolveRemedialPlayTarget({
          subject: "Math",
          basePath: "/MasterTeacher/RemedialTeacher/remedial",
          studentId: String(studentId),
          studentPhonemicLevel: phonemicLevel,
          studentGrade: student?.grade ?? null,
          userId,
        });

        if ("error" in result) {
          setStatusToast({
            title: "Unable to Start Session",
            message: result.error,
            tone: "error",
          });
          return;
        }

        router.push(result.playPath);
      } catch (error) {
        console.error("Failed to start remedial session", error);
        setStatusToast({
          title: "Unable to Start Session",
          message: "Unable to start remedial session.",
          tone: "error",
        });
      } finally {
        setPlayLoadingId(null);
      }
    };

    void run();
  };

  const handlePromoteFromModal = (subject: "English" | "Filipino" | "Math") => {
    const run = async () => {
      const studentId = selectedStudent?.studentId ?? selectedStudent?.id ?? "";
      if (!studentId) {
        setStatusToast({
          title: "Missing Student",
          message: "Student ID is missing.",
          tone: "error",
        });
        return;
      }

      const currentLevel = String(
        subject === "English"
          ? selectedStudent?.englishPhonemic ?? selectedStudent?.english ?? ""
          : subject === "Filipino"
            ? selectedStudent?.filipinoPhonemic ?? selectedStudent?.filipino ?? ""
            : selectedStudent?.mathProficiency ?? selectedStudent?.math ?? "",
      ).trim();

      setPromoteLoadingId(String(studentId));
      try {
        const response = await fetch("/api/teacher/remedial/students/promote-phonemic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: String(studentId),
            subject,
            currentLevel,
            requestedBy: userId,
          }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error ?? "Unable to promote student phonemic level.");
        }

        const nextLevel = payload?.nextLevel?.level_name ?? payload?.nextLevel?.levelName ?? "";
        if (nextLevel) {
          const applyPromotedLevel = (entry: any) => {
            if (!entry) {
              return entry;
            }
            if (subject === "English") {
              return {
                ...entry,
                englishPhonemic: nextLevel,
                english: nextLevel,
              };
            }
            if (subject === "Filipino") {
              return {
                ...entry,
                filipinoPhonemic: nextLevel,
                filipino: nextLevel,
              };
            }
            return {
              ...entry,
              mathProficiency: nextLevel,
              math: nextLevel,
            };
          };

          setStudents((prev) =>
            prev.map((entry: any) => {
              const entryId = entry?.studentId ?? entry?.id;
              if (String(entryId) !== String(studentId)) {
                return entry;
              }
              return applyPromotedLevel(entry);
            })
          );
          setSelectedStudent((prev: any) => applyPromotedLevel(prev));
          setPromotionRecommendationRefreshKey((prev) => prev + 1);
        }
      } catch (error) {
        setStatusToast({
          title: "Promotion Failed",
          message: error instanceof Error ? error.message : "Failed to promote student.",
          tone: "error",
        });
      } finally {
        setPromoteLoadingId(null);
      }
    };

    void run();
  };

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {sortedStudents.length}
        </p>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="inline-flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5 w-fit">
            <span className="text-sm text-gray-700 whitespace-nowrap">Phonemic:</span>
            <CustomDropdown 
              options={[ALL_PHONEMIC, ...PHONEMIC_LEVELS]}
              value={filter.phonemic}
              onChange={(value) => setFilter({ phonemic: value })}
              className="w-auto"
            />
          </div>
          <button
            type="button"
            onClick={handleExportClick}
            className={utilityCircleButtonClass}
            aria-label="Export to Excel"
            title="Export to Excel"
          >
            <ExportIcon />
          </button>
          <SortMenu
            small
            iconOnly
            align="right"
            value={sortBy}
            items={STUDENT_SORT_ITEMS}
            onChange={setSortBy}
            onClearAll={handleClearAll}
            clearAllDisabled={!hasActiveSortOrFilter}
            buttonAriaLabel="Sort"
            buttonTitle="Sort"
            iconButtonClassName={utilityCircleButtonClass}
            iconClassName="h-4.5 w-4.5"
          />
        </div>
      </div>

      {/* Modal for Add Student Form */}
      <AddStudentModal
        show={showModal}
        onClose={() => {
          setShowModal(false);
          reset();
        }}
        form={formMethods}
        onSubmit={onSubmit}
      />

      {/* Student Detail Modal */}
      <StudentDetailModal
        show={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedStudent(null);
        }}
        student={selectedStudent}
        reportHref={
          selectedStudent
            ? `/MasterTeacher/RemedialTeacher/report/math/students/${encodeURIComponent(String(selectedStudent.studentId ?? selectedStudent.id ?? ""))}`
            : undefined
        }
        promotionRecommendationApiPath="/api/teacher/remedial/students/promotion-readiness"
        promotionRecommendationRefreshKey={promotionRecommendationRefreshKey}
        onPromote={handlePromoteFromModal}
        promoteLoading={
          !selectedStudent ||
          promoteLoadingId === String(selectedStudent?.studentId ?? selectedStudent?.id ?? "")
        }
      />

      {/* Student Table Section */}
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
          { key: "phonemic", title: "Phonemic" },
        ]}
        data={sortedStudents.map((student, idx) => ({
          ...student,
          name: formatStudentDisplayName(student), // Display as "Surname, FirstName M.I."
          fullLrn: normalizeLrn(student.lrn) ?? "N/A",
          maskedLrn: maskLrnForDisplay(student.lrn),
          phonemic: student.mathProficiency ?? "",
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleViewDetails(row)}
              title="View student details"
              className="inline-flex h-10 items-center rounded-lg border border-emerald-700 bg-white px-4 text-sm font-semibold text-emerald-800 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 hover:bg-emerald-50"
            >
              View
            </button>
            <UtilityButton
              small
              type="button"
              onClick={() => handlePlayClick(row)}
              title="Click to play remedial session"
              disabled={playLoadingId === String(row?.studentId ?? row?.id ?? "")}
            >
              Play
            </UtilityButton>
          </div>
        )}
        selectable={selectMode}
        selectedItems={selectedStudents}
        onSelectAll={handleSelectAll}
        onSelectItem={handleSelectStudent}
        pageSize={10}
      />
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleUploadCancel}
        onConfirm={handleUploadConfirm}
        title="Confirm File Upload"
        message="Are you sure you want to upload this Excel file? This will import student data."
        fileName={selectedFile?.name}
      />
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
        }}
        onConfirm={confirmDelete}
        title="Confirm Delete"
        message={`Are you sure you want to delete ${selectedStudents.size} selected student${selectedStudents.size > 1 ? 's' : ''}? This action cannot be undone.`}
      />
      {statusToast && (
        <ToastActivity
          title={statusToast.title}
          message={statusToast.message}
          tone={statusToast.tone}
          onClose={() => setStatusToast(null)}
        />
      )}
    </div>
  );
}
