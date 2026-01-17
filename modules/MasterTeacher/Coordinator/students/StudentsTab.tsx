import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import * as XLSX from "xlsx";
import AddStudentModal, { type AddStudentFormValues } from "./Modals/AddStudentModal";
import StudentDetailModal from "./Modals/StudentDetailModal";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
import DeleteConfirmationModal from "@/components/Common/Modals/DeleteConfirmationModal";
// Button Components
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";
import KebabMenu from "@/components/Common/Menus/KebabMenu";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import { normalizeMaterialSubject, type MaterialSubject } from "@/lib/materials/shared";

const sections = ["All Sections", "A", "B", "C"];
const SUBJECT_FALLBACK: MaterialSubject = "English";

// Normalize grade values to numeric strings ("1"-"6")
const normalizeGradeLabel = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const match = String(value).match(/\d+/);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[0], 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return String(parsed);
};

const hashLrnForDisplay = (lrn?: string | null): string => {
  if (!lrn) return "N/A";
  const normalized = lrn.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!normalized) return "N/A";
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
    hash >>>= 0;
  }
  return `#${hash.toString(16).toUpperCase().padStart(8, "0")}`;
};

const resolveStudentPhonemic = (
  student: CoordinatorStudent,
  subjectLabel?: MaterialSubject | null,
): string => {
  const normalizedSubject = normalizeMaterialSubject(subjectLabel ?? SUBJECT_FALLBACK) ?? SUBJECT_FALLBACK;
  switch (normalizedSubject) {
    case "English":
      return student.englishPhonemic || student.filipinoPhonemic || student.mathProficiency || "";
    case "Filipino":
      return student.filipinoPhonemic || student.englishPhonemic || student.mathProficiency || "";
    case "Math":
      return student.mathProficiency || student.englishPhonemic || student.filipinoPhonemic || "";
    default:
      return student.englishPhonemic || student.filipinoPhonemic || student.mathProficiency || "";
  }
};

const formatStudentDisplayName = (student: any): string => {
  const first = (student.firstName ?? "").trim();
  const middle = (student.middleName ?? "").trim();
  const last = (student.lastName ?? "").trim();

  const buildFormatted = (lastName: string, firstName: string, middleName: string) => {
    if (!lastName && !firstName && !middleName) return "";
    const middleInitials = middleName
      .split(/\s+/)
      .filter(Boolean)
      .map((value) => value.charAt(0).toUpperCase() + ".")
      .join(" ");

    if (lastName && firstName) {
      return middleInitials
        ? `${lastName}, ${firstName} ${middleInitials}`
        : `${lastName}, ${firstName}`;
    }

    const base = [lastName, firstName].filter(Boolean).join(" ") || middleName;
    return middleInitials ? `${base} ${middleInitials}`.trim() : base.trim();
  };

  if (first || last || middle) {
    return buildFormatted(last, first, middle);
  }

  const raw = (student.name ?? "").trim();
  if (!raw) return "";

  const commaParts = raw.split(",").map((part: string) => part.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const lastName = commaParts[0];
    const firstAndMiddle = commaParts[1] ?? "";
    const firstParts = firstAndMiddle.split(/\s+/).filter(Boolean);
    const firstName = firstParts[0] ?? "";
    const middleFromFirst = firstParts.slice(1).join(" ");
    const middleFromComma = commaParts.slice(2).join(" ");
    const middleName = [middleFromFirst, middleFromComma].filter(Boolean).join(" ");
    return buildFormatted(lastName, firstName, middleName);
  }

  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const middleName = parts.slice(1, -1).join(" ");
  return buildFormatted(lastName, firstName, middleName);
};

const parseNameParts = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return { firstName: "", middleName: "", lastName: "" };
  }

  const commaParts = trimmed.split(",").map((part: string) => part.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const lastName = commaParts[0];
    const firstAndMiddle = commaParts[1] ?? "";
    const firstParts = firstAndMiddle.split(/\s+/).filter(Boolean);
    const firstName = firstParts[0] ?? "";
    const middleFromFirst = firstParts.slice(1).join(" ");
    const middleFromComma = commaParts.slice(2).join(" ");
    const middleName = [middleFromFirst, middleFromComma]
      .filter(Boolean)
      .join(" ")
      .replace(/\.+$/g, "")
      .trim();
    return { firstName, middleName, lastName };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], middleName: "", lastName: "" };
  }
  return {
    firstName: parts[0] ?? "",
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1] ?? "",
  };
};

export type CoordinatorStudent = {
  id: string;
  studentId: string;
  lrn?: string;
  name: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  grade: string;
  section: string;
  age: string;
  guardian: string;
  guardianContact: string;
  guardianEmail?: string | null;
  address: string;
  relationship: string;
  englishPhonemic: string;
  filipinoPhonemic: string;
  mathProficiency: string;
};

type CreateStudentPayload = {
  studentId?: string;
  lrn?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  name: string;
  grade?: string;
  section?: string;
  guardian?: string;
  guardianFirstName?: string;
  guardianMiddleName?: string;
  guardianLastName?: string;
  guardianSuffix?: string;
  guardianContact?: string;
  guardianEmail?: string;
  address?: string;
  age?: string;
  relationship?: string;
  englishPhonemic?: string;
  filipinoPhonemic?: string;
  mathProficiency?: string;
};

type CoordinatorAssignment = {
  subject: MaterialSubject;
  gradeLevel: string | null;
};

const transformApiRecord = (record: any): CoordinatorStudent => {
  const rawName = (record.fullName ?? record.name ?? "").toString();
  const parsed = parseNameParts(rawName);
  return {
    id: record.id ? String(record.id) : "",
    studentId: record.studentIdentifier ?? record.id ?? "",
    lrn: record.lrn ?? null,
    name: record.fullName ?? record.name ?? "Unnamed Student",
    firstName: record.firstName ?? record.first_name ?? parsed.firstName ?? null,
    middleName: record.middleName ?? record.middle_name ?? parsed.middleName ?? null,
    lastName: record.lastName ?? record.last_name ?? parsed.lastName ?? null,
    grade: record.gradeLevel ?? record.grade ?? "",
    section: record.section ?? "",
    age: record.age ?? "",
    guardian: record.guardianName ?? record.guardian ?? "",
    guardianContact: record.guardianContact ?? "",
    guardianEmail: record.guardianEmail ?? record.parentEmail ?? null,
    address: record.address ?? "",
    relationship: record.relationship ?? "",
    englishPhonemic: record.englishPhonemic ?? "",
    filipinoPhonemic: record.filipinoPhonemic ?? "",
    mathProficiency: record.mathProficiency ?? "",
  };
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

interface StudentTabProps {
  searchTerm: string;
  onMetaChange?: (meta: { subject: MaterialSubject; gradeLevel: string | null }) => void;
}

type CoordinatorStudentFormInput = CreateStudentPayload;

export default function StudentTab({ searchTerm, onMetaChange }: StudentTabProps) {
  const [subject, setSubject] = useState<MaterialSubject>(SUBJECT_FALLBACK);
  const [gradeLevel, setGradeLevel] = useState<string | null>(null);
  const [students, setStudents] = useState<CoordinatorStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [filter, setFilter] = useState({ section: "All Sections" });
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const fetchSubject = useCallback(async (): Promise<CoordinatorAssignment> => {
    if (!userId) {
      setError("Missing coordinator profile. Please log in again.");
      setGradeLevel(null);
      return { subject: SUBJECT_FALLBACK, gradeLevel: null } satisfies CoordinatorAssignment;
    }

    try {
      const response = await fetch(
        `/api/master_teacher/coordinator/profile?userId=${encodeURIComponent(String(userId))}`,
        {
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Unable to determine coordinator subject.");
      }
      const subjectCandidate = payload.coordinator?.coordinatorSubject ?? payload.coordinator?.subjectsHandled ?? null;
      const resolved = normalizeMaterialSubject(subjectCandidate) ?? SUBJECT_FALLBACK;
      const gradeCandidate = payload.coordinator?.gradeLevel ?? null;
      const normalizedGrade = normalizeGradeLabel(
        typeof gradeCandidate === "string"
          ? gradeCandidate
          : gradeCandidate !== null && gradeCandidate !== undefined
            ? String(gradeCandidate)
            : undefined,
      ) ?? null;
      setGradeLevel(normalizedGrade);
      setSubject(resolved);
      return { subject: resolved, gradeLevel: normalizedGrade } satisfies CoordinatorAssignment;
    } catch (err) {
      console.error("Failed to load coordinator subject", err);
      setError(err instanceof Error ? err.message : "Unable to determine subject.");
      setGradeLevel(null);
      setSubject(SUBJECT_FALLBACK);
      return { subject: SUBJECT_FALLBACK, gradeLevel: null } satisfies CoordinatorAssignment;
    }
  }, [userId]);

  const fetchStudents = useCallback(
    async (resolvedSubject?: MaterialSubject, resolvedGradeLevel?: string | null) => {
      const subjectToUse = resolvedSubject ?? subject;
      const gradeLevelToUse = resolvedGradeLevel ?? gradeLevel;
      if (!userId) {
        setError("Missing coordinator profile. Please log in again.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      if (!gradeLevelToUse || !gradeLevelToUse.trim()) {
        setStudents([]);
        setError("Grade assignment is required to load students.");
        setLoading(false);
        return;
      }
      try {
        const params = new URLSearchParams({ subject: subjectToUse });
        params.set("gradeLevel", gradeLevelToUse.trim());

        const response = await fetch(`/api/master_teacher/coordinator/students?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch students (${response.status})`);
        }
        const payload = await response.json();
        const data = Array.isArray(payload?.data) ? payload.data : [];
        setStudents(data.map(transformApiRecord));
      } catch (err) {
        console.error("Failed to fetch coordinator students", err);
        setError(err instanceof Error ? err.message : "Unable to load students.");
      } finally {
        setLoading(false);
      }
    },
    [gradeLevel, subject, userId],
  );

  useEffect(() => {
    (async () => {
      const assignment = await fetchSubject();
      await fetchStudents(assignment.subject, assignment.gradeLevel);
    })();
  }, [fetchSubject, fetchStudents]);

  useEffect(() => {
    onMetaChange?.({ subject, gradeLevel });
  }, [subject, gradeLevel, onMetaChange]);

  const persistStudents = useCallback(
    async (studentsPayload: CreateStudentPayload[]) => {
      if (!userId) {
        setError("Missing coordinator profile. Please log in again.");
        return;
      }
      if (studentsPayload.length === 0) {
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const response = await fetch("/api/master_teacher/coordinator/students", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            createdBy: userId,
            subject,
            students: studentsPayload.map((student) => ({
              studentIdentifier: student.studentId ?? null,
              lrn: student.lrn ?? null,
              firstName: student.firstName ?? null,
              middleName: student.middleName ?? null,
              lastName: student.lastName ?? null,
              suffix: student.suffix ?? null,
              fullName: student.name,
              gradeLevel: student.grade ?? null,
              section: student.section ?? null,
              age: student.age ?? null,
              guardianName: student.guardian ?? null,
              guardianFirstName: student.guardianFirstName ?? null,
              guardianMiddleName: student.guardianMiddleName ?? null,
              guardianLastName: student.guardianLastName ?? null,
              guardianSuffix: student.guardianSuffix ?? null,
              guardianContact: student.guardianContact ?? null,
              guardianEmail: student.guardianEmail ?? null,
              relationship: student.relationship ?? null,
              address: student.address ?? null,
              englishPhonemic: student.englishPhonemic ?? null,
              filipinoPhonemic: student.filipinoPhonemic ?? null,
              mathProficiency: student.mathProficiency ?? null,
            })),
          }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "Failed to save students");
        }
        await fetchStudents();
      } catch (err) {
        console.error("Failed to persist students", err);
        setError(err instanceof Error ? err.message : "Failed to save students.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [fetchStudents, subject, userId],
  );

  const addStudent = useCallback(async (student: CreateStudentPayload) => {
    await persistStudents([student]);
  }, [persistStudents]);

  const updateStudent = useCallback(
    async (id: number, student: CreateStudentPayload) => {
      if (!userId) {
        setError("Missing coordinator profile. Please log in again.");
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const response = await fetch(`/api/master_teacher/coordinator/students/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            studentIdentifier: student.studentId ?? null,
            lrn: student.lrn ?? null,
              firstName: student.firstName ?? null,
              middleName: student.middleName ?? null,
              lastName: student.lastName ?? null,
              suffix: student.suffix ?? null,
            fullName: student.name,
            gradeLevel: student.grade ?? null,
            section: student.section ?? null,
            age: student.age ?? null,
            guardianName: student.guardian ?? null,
              guardianFirstName: student.guardianFirstName ?? null,
              guardianMiddleName: student.guardianMiddleName ?? null,
              guardianLastName: student.guardianLastName ?? null,
              guardianSuffix: student.guardianSuffix ?? null,
            guardianContact: student.guardianContact ?? null,
            guardianEmail: student.guardianEmail ?? null,
            relationship: student.relationship ?? null,
            address: student.address ?? null,
            englishPhonemic: student.englishPhonemic ?? null,
            filipinoPhonemic: student.filipinoPhonemic ?? null,
            mathProficiency: student.mathProficiency ?? null,
          }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "Failed to update student");
        }
        await fetchStudents();
      } catch (err) {
        console.error("Failed to update student", err);
        setError(err instanceof Error ? err.message : "Failed to update student.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [fetchStudents, userId],
  );

  const importStudents = useCallback(async (studentList: CreateStudentPayload[]) => {
    await persistStudents(studentList);
  }, [persistStudents]);

  const deleteStudents = useCallback(
    async (ids: string[]) => {
      if (!userId || ids.length === 0) {
        return;
      }
      setSaving(true);
      setError(null);
      try {
        await Promise.all(
          ids.map(async (id) => {
            const response = await fetch(
              `/api/master_teacher/coordinator/students/${id}?userId=${encodeURIComponent(String(userId))}`,
              {
                method: "DELETE",
              },
            );
            if (!response.ok) {
              const payload = await response.json().catch(() => null);
              throw new Error(payload?.error ?? "Failed to delete student");
            }
          }),
        );
        await fetchStudents();
      } catch (err) {
        console.error("Failed to delete students", err);
        setError(err instanceof Error ? err.message : "Failed to delete students.");
      } finally {
        setSaving(false);
      }
    },
    [fetchStudents, userId],
  );

  const buildDefaultValues = useCallback((): AddStudentFormValues => ({
    studentId: "",
    lrn: "",
    role: "Student",
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    grade: gradeLevel?.trim() ?? "",
    section: "",
    guardianFirstName: "",
    guardianMiddleName: "",
    guardianLastName: "",
    guardianSuffix: "",
    relationship: "",
    guardianContact: "",
    guardianEmail: "",
    address: "",
    englishPhonemic: "",
    filipinoPhonemic: "",
    mathPhonemic: "",
  }), [gradeLevel]);

  // React Hook Form setup
  const formMethods = useForm<AddStudentFormValues>({
    defaultValues: buildDefaultValues(),
  });
  const { reset, setValue } = formMethods;

  useEffect(() => {
    reset(buildDefaultValues());
  }, [buildDefaultValues, reset]);

  useEffect(() => {
    if (gradeLevel && gradeLevel.trim().length > 0) {
      setValue("grade", gradeLevel.trim(), { shouldDirty: false, shouldTouch: false, shouldValidate: false });
    }
  }, [gradeLevel, setValue]);

  // Add or update student
  const onSubmit = async (data: AddStudentFormValues) => {
    const effectiveGrade = gradeLevel && gradeLevel.trim().length > 0 ? gradeLevel.trim() : data.grade;
    if (!effectiveGrade || effectiveGrade.trim().length === 0) {
      alert("Grade level is required.");
      return;
    }
    try {
      const payload: CoordinatorStudentFormInput = {
        studentId: data.studentId || undefined,
        lrn: data.lrn?.trim() || undefined,
        firstName: data.firstName?.trim() || undefined,
        middleName: data.middleName?.trim() || undefined,
        lastName: data.lastName?.trim() || undefined,
        suffix: data.suffix?.trim() || undefined,
        name: [data.firstName, data.middleName, data.lastName, data.suffix].filter((part) => part && part.trim().length > 0).join(" ") || "Unnamed Student",
        grade: normalizeGradeLabel(effectiveGrade) ?? "",
        section: data.section || undefined,
        age: undefined,
        address: data.address || undefined,
        guardian: [data.guardianFirstName, data.guardianMiddleName, data.guardianLastName, data.guardianSuffix]
          .filter((part) => part && part.trim().length > 0)
          .join(" ") || undefined,
        guardianFirstName: data.guardianFirstName?.trim() || undefined,
        guardianMiddleName: data.guardianMiddleName?.trim() || undefined,
        guardianLastName: data.guardianLastName?.trim() || undefined,
        guardianSuffix: data.guardianSuffix?.trim() || undefined,
        guardianContact: data.guardianContact || undefined,
        guardianEmail: data.guardianEmail?.trim() || undefined,
        relationship: data.relationship || undefined,
        englishPhonemic: data.englishPhonemic || undefined,
        filipinoPhonemic: data.filipinoPhonemic || undefined,
        mathProficiency: data.mathPhonemic || undefined,
      };
      
      if (editingStudent) {
        await updateStudent(editingStudent.id, payload);
        setEditingStudent(null);
      } else {
        await addStudent(payload);
      }
      
      reset();
      setShowModal(false);
    } catch (error) {
      console.error(editingStudent ? "Failed to update student" : "Failed to add student", error);
      alert(error instanceof Error ? error.message : editingStudent ? "Failed to update student." : "Failed to add student.");
    }
  };

  // Handle student selection
  const handleSelectStudent = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedStudents);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedStudents(newSelected);
  };

  // Filter students based on search term and section
  const filteredStudents = students.filter((student) => {
    const matchSection = filter.section === "All Sections" || student.section === filter.section;
    const matchSearch = searchTerm === "" || 
      student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.grade?.toString().includes(searchTerm.toLowerCase()) ||
      student.section?.toLowerCase().includes(searchTerm.toLowerCase());
      
    return matchSection && matchSearch;
  });

  const tableRows = useMemo(() => (
    filteredStudents.map((student, idx) => ({
      ...student,
      no: idx + 1,
      name: formatStudentDisplayName(student),
      hashedLrn: hashLrnForDisplay(student.lrn),
      phonemic: resolveStudentPhonemic(student, subject),
    }))
  ), [filteredStudents, subject]);

  const handleExport = () => {
    if (tableRows.length === 0) {
      alert("No students available to export.");
      return;
    }

    const exportData = tableRows.map((student) => ({
      "No#": student.no,
      "Student ID": student.studentId ?? "",
      "LRN (Hashed)": student.hashedLrn,
      "Full Name": student.name ?? "",
      Phonemic: student.phonemic ?? "",
      Grade: student.grade ?? "",
      Section: student.section ?? "",
      Guardian: student.guardian ?? "",
      "Guardian Contact": student.guardianContact ?? "",
      Address: student.address ?? "",
    }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Students");

  const timestamp = new Date().toISOString().replace(/[:.-]/g, "");
  const sanitizedSubject = subject.replace(/\s+/g, "");
  const filename = `MasterTeacher_${sanitizedSubject}_Students_${timestamp}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
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

  const confirmDelete = async () => {
    try {
      await deleteStudents(Array.from(selectedStudents));
      setSelectedStudents(new Set());
      setSelectMode(false);
      setShowDeleteModal(false);
    } catch (error) {
      console.error("Failed to delete students", error);
      alert(error instanceof Error ? error.message : "Failed to delete students.");
    }
  };

  // Handle viewing student details
  const handleViewDetails = (student: any) => {
    setSelectedStudent({ ...student, subjectAssigned: subject });
    setShowDetailModal(true);
  };

  // Handle editing student
  const handleEditStudent = (student: any) => {
    setShowDetailModal(false);
    setEditingStudent(student);
    
    const parsedStudentName = parseNameParts(student.name || "");
    const firstName = student.firstName ?? parsedStudentName.firstName ?? "";
    const middleName = student.middleName ?? parsedStudentName.middleName ?? "";
    const lastName = student.lastName ?? parsedStudentName.lastName ?? "";

    const parsedGuardianName = parseNameParts(student.guardian || "");
    const guardianFirstName = student.guardianFirstName ?? parsedGuardianName.firstName ?? "";
    const guardianMiddleName = student.guardianMiddleName ?? parsedGuardianName.middleName ?? "";
    const guardianLastName = student.guardianLastName ?? parsedGuardianName.lastName ?? "";
    
    reset({
      studentId: student.studentId || "",
      lrn: student.lrn || "",
      role: "Student",
      firstName,
      middleName,
      lastName,
      suffix: "",
      grade: student.grade || gradeLevel?.trim() || "",
      section: student.section || "",
      guardianFirstName,
      guardianMiddleName,
      guardianLastName,
      guardianSuffix: "",
      relationship: student.relationship || "",
      guardianContact: student.guardianContact || "",
      guardianEmail: student.guardianEmail || "",
      address: student.address || "",
      englishPhonemic: student.englishPhonemic || "",
      filipinoPhonemic: student.filipinoPhonemic || "",
      mathPhonemic: student.mathProficiency || "",
    });
    
    setShowModal(true);
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['.xlsx', '.xls'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!validTypes.includes(fileExtension)) {
      alert('Please upload only Excel files (.xlsx or .xls)');
      return;
    }

    setSelectedFile(file);
    setShowConfirmModal(true);
  };

  // Handle file upload confirmation
  const handleUploadConfirm = async () => {
    if (!selectedFile) return;

    const assignedGrade = normalizeGradeLabel(gradeLevel);
    if (!assignedGrade) {
      alert("Grade assignment is required before uploading.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const readField = (row: any, keys: string[]): string => {
          for (const key of keys) {
            if (row[key] !== undefined && row[key] !== null) {
              const value = String(row[key]).trim();
              if (value.length > 0) return value;
            }
          }
          return '';
        };

        const newStudents = jsonData.map((row: any) => {
          const firstName = readField(row, ['FIRSTNAME', 'FIRST_NAME', 'FIRST NAME', 'First Name', 'firstName']);
          const middleName = readField(row, ['MIDDLENAME', 'MIDDLE_NAME', 'MIDDLE NAME', 'Middle Name', 'middleName']);
          const lastName = readField(row, ['SURNAME', 'LASTNAME', 'LAST_NAME', 'LAST NAME', 'Last Name', 'lastName']);
          const studentName = `${firstName} ${middleName} ${lastName}`.trim();

          const lrn = readField(row, ['LRN', 'Lrn', 'lrn']);

          const guardianFirst = readField(row, ["GUARDIAN'S FIRSTNAME", "GUARDIAN FIRSTNAME", "Guardian First Name", 'guardianFirstName']);
          const guardianMiddle = readField(row, ["GUARDIAN'S MIDDLENAME", "GUARDIAN MIDDLENAME", "Guardian Middle Name", 'guardianMiddleName']);
          const guardianLast = readField(row, ["GUARDIAN'S SURNAME", "GUARDIAN SURNAME", "Guardian Last Name", 'guardianLastName']);
          const guardianName = `${guardianFirst} ${guardianMiddle} ${guardianLast}`.trim();

          const subjectPhonemic = readField(row, ['SUBJECT PHONEMIC', 'Subject Phonemic', 'subjectPhonemic', 'PHONEMIC', 'Phonemic']);
          const gradeFromSheet = readField(row, ['GRADE', 'Grade', 'grade']);
          const resolvedGrade = normalizeGradeLabel(assignedGrade ?? gradeFromSheet) ?? "";

          return {
            studentId: readField(row, ['STUDENT ID', 'Student ID', 'studentId', 'ID']),
            lrn: lrn || undefined,
            firstName: firstName || '',
            middleName: middleName || '',
            lastName: lastName || '',
            name: studentName || 'Unnamed Student',
            grade: resolvedGrade,
            section: readField(row, ['SECTION', 'Section', 'section']),
            age: readField(row, ['AGE', 'Age', 'age']),
            address: readField(row, ['ADDRESS', 'Address', 'address']),
            guardian: guardianName || '',
            guardianFirstName: guardianFirst || '',
            guardianMiddleName: guardianMiddle || '',
            guardianLastName: guardianLast || '',
            guardianContact: readField(row, ["GUARDIAN'S CONTACT", "GUARDIAN'S CONTACT NUMBER", 'CONTACT NUMBER', 'CONTACT_NUMBER', 'Contact Number', 'contactNumber', 'GUARDIAN CONTACT', 'Guardian Contact', 'GUARDIAN_CONTACT', 'guardianContact']),
            relationship: readField(row, ['RELATIONSHIP', 'Relationship', 'relationship']),
            englishPhonemic: subject?.toLowerCase() === 'english' ? subjectPhonemic : '',
            filipinoPhonemic: subject?.toLowerCase() === 'filipino' ? subjectPhonemic : '',
            mathProficiency: subject?.toLowerCase() === 'math' ? subjectPhonemic : '',
          } satisfies CoordinatorStudentFormInput;
        });

        void importStudents(newStudents).catch((error) => {
          console.error('Failed to import students', error);
          alert(error instanceof Error ? error.message : 'Failed to import students.');
        });
      } catch (error) {
        console.error(error);
        alert('Error reading Excel file. Please check the format and column headers.');
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

  const actionsDisabled = saving || loading;

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {filteredStudents.length}
          {loading && <span className="ml-2 text-xs text-gray-400">Loading...</span>}
        </p>
        {error && <span className="text-sm text-red-600">{error}</span>}
        
        <div className="flex flex-row sm:flex-row sm:items-center gap-3 ">
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
            <span className="text-sm text-gray-700 whitespace-nowrap">Section:</span>
            <CustomDropdown 
              options={sections}
              value={filter.section}
              onChange={(value) => setFilter({ section: value })}
              className="min-w-[120px]"
            />
          </div>
          
          <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <SecondaryButton small onClick={handleCancelSelect}>
                Cancel
              </SecondaryButton>
              {selectedStudents.size > 0 && (
                  <>
<DangerButton small onClick={handleDeleteSelected} className="flex items-center gap-1" disabled={actionsDisabled}>
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-icon lucide-trash"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
  Delete ({selectedStudents.size})
</DangerButton>
                </>
              )}
            </>
          ) : (
            <KebabMenu
              small
              align="right"
              renderItems={(close) => (
                <div className="py-1">
                  <button
                    disabled={actionsDisabled}
                    onClick={() => {
                      if (actionsDisabled) return;
                      setShowModal(true);
                      close();
                    }}
                    className={`w-full px-4 py-2 text-left text-sm text-[#013300] flex items-center gap-2 ${actionsDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Student
                  </button>
                  <button
                    disabled={actionsDisabled}
                    onClick={() => {
                      if (actionsDisabled) return;
                      fileInputRef.current?.click();
                      close();
                    }}
                    className={`w-full px-4 py-2 text-left text-sm text-[#013300] flex items-center gap-2 ${actionsDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="m17 8-5-5-5 5" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    </svg>
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!filteredStudents.length) {
                        alert("No students available to export.");
                        return;
                      }
                      handleExport();
                      close();
                    }}
                    className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#013300] ${
                      filteredStudents.length === 0 || actionsDisabled
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-gray-50"
                    }`}
                    aria-disabled={filteredStudents.length === 0 || actionsDisabled}
                  >
                    <ExportIcon />
                    Export to Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = '/masterteacher/coordinator/students/Student List Template.xlsx';
                      link.download = 'Student List Template.xlsx';
                      link.click();
                      close();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50"
                  >
                    <ExportIcon />
                    Download Template
                  </button>
                  <button
                    disabled={actionsDisabled}
                    onClick={() => {
                      if (actionsDisabled) return;
                      handleEnterSelectMode();
                      close();
                    }}
                    className={`mt-1 w-full px-4 py-2 text-left text-sm text-[#013300] flex items-center gap-2 ${actionsDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                    Select
                  </button>
                </div>
              )}
            />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          </div>
        </div>
      </div>

      {/* Modal for Add/Edit Student Form */}
      <AddStudentModal
        show={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingStudent(null);
          reset(buildDefaultValues());
        }}
        form={formMethods}
        onSubmit={onSubmit}
        isSubmitting={saving}
        apiError={error}
        subjectLabel={subject}
        gradeLabel={gradeLevel}
        isEditing={!!editingStudent}
      />

      {/* Student Detail Modal */}
      <StudentDetailModal
        show={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        student={selectedStudent}
        onEdit={handleEditStudent}
      />

      {/* Student Table Section */}
      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "studentId", title: "Student ID" },
          { key: "hashedLrn", title: "LRN" },
          { key: "name", title: "Full Name" },
          { key: "phonemic", title: "Phonemic" },
        ]}
        data={tableRows}
        actions={(row: any) => (
          <UtilityButton small onClick={() => handleViewDetails(row)} title="View student details">
            View
          </UtilityButton>
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
    </div>
  );
}