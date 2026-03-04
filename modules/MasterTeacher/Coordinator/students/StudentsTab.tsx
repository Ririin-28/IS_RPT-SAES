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
import SortMenu, { type SortMenuItem } from "@/components/Common/Menus/SortMenu";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import { normalizeMaterialSubject, type MaterialSubject } from "@/lib/materials/shared";

const SUBJECT_FALLBACK: MaterialSubject = "English";

const PHONEMIC_LEVELS_BY_SUBJECT: Record<MaterialSubject, string[]> = {
  English: ["Non-Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"],
  Filipino: ["Non-Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"],
  Math: ["Not Proficient", "Low Proficient", "Nearly Proficient", "Proficient", "Highly Proficient"],
};

// Normalize grade values to numeric strings ("1"-"6")
const normalizeGradeLabel = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const match = String(value).match(/\d+/);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[0], 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return String(parsed);
};

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

const normalizePhonemicLabel = (value: string): string => value.trim().toLowerCase();

const getPhonemicLevels = (subjectLabel?: MaterialSubject | null): string[] => {
  const normalized = normalizeMaterialSubject(subjectLabel ?? SUBJECT_FALLBACK) ?? SUBJECT_FALLBACK;
  return PHONEMIC_LEVELS_BY_SUBJECT[normalized] ?? PHONEMIC_LEVELS_BY_SUBJECT[SUBJECT_FALLBACK];
};

const buildPhonemicOrder = (subjectLabel?: MaterialSubject | null): Map<string, number> => {
  const levels = getPhonemicLevels(subjectLabel);
  const order = new Map<string, number>();
  levels.forEach((level, index) => {
    order.set(normalizePhonemicLabel(level), index);
  });
  return order;
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
  guardianFirstName?: string | null;
  guardianMiddleName?: string | null;
  guardianLastName?: string | null;
  guardianSuffix?: string | null;
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
    guardianFirstName: record.guardianFirstName ?? record.parentFirstName ?? record.parent_first_name ?? null,
    guardianMiddleName: record.guardianMiddleName ?? record.parentMiddleName ?? record.parent_middle_name ?? null,
    guardianLastName: record.guardianLastName ?? record.parentLastName ?? record.parent_last_name ?? null,
    guardianSuffix: record.guardianSuffix ?? record.parentSuffix ?? record.parent_suffix ?? null,
    guardianContact: record.guardianContact ?? "",
    guardianEmail: record.guardianEmail ?? record.parentEmail ?? null,
    address: record.address ?? "",
    relationship: record.relationship ?? "",
    englishPhonemic: record.englishPhonemic ?? "",
    filipinoPhonemic: record.filipinoPhonemic ?? "",
    mathProficiency: record.mathProficiency ?? "",
  };
};

const ImportStudentsIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
  </svg>
);

const ExportStudentListIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m17 8-5-5-5 5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
  </svg>
);

const ExportTemplateIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v5a1 1 0 0 0 1 1h5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v6" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m15 15-3-3-3 3" />
  </svg>
);

type StudentSortKey =
  | "name_asc"
  | "name_desc"
  | "lrn_asc"
  | "lrn_desc"
  | "phonemic_low_high"
  | "phonemic_high_low";

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

const DEFAULT_STUDENT_SORT: StudentSortKey = "name_asc";

interface StudentTabProps {
  searchTerm: string;
  onMetaChange?: (meta: { subject: MaterialSubject; gradeLevel: string | null; students: CoordinatorStudent[] }) => void;
  onAssignStudents?: () => void;
  assignStudentsDisabled?: boolean;
}

type CoordinatorStudentFormInput = CreateStudentPayload;

export default function StudentTab({
  searchTerm,
  onMetaChange,
  onAssignStudents,
  assignStudentsDisabled = false,
}: StudentTabProps) {
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
  const [sortBy, setSortBy] = useState<StudentSortKey>(DEFAULT_STUDENT_SORT);
  const [duplicateLrn, setDuplicateLrn] = useState<string | null>(null);
  const [duplicateStudent, setDuplicateStudent] = useState<CoordinatorStudent | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [crossGradeLrn, setCrossGradeLrn] = useState<string | null>(null);
  const [crossGradeStudentName, setCrossGradeStudentName] = useState<string | null>(null);
  const [showCrossGradeModal, setShowCrossGradeModal] = useState(false);
  const [visibleLrnIds, setVisibleLrnIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lrnRevealTimersRef = useRef<Record<string, number>>({});

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
    return () => {
      Object.values(lrnRevealTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
      lrnRevealTimersRef.current = {};
    };
  }, []);

  const handleRevealLrn = useCallback((rowId: string) => {
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
  }, []);

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

  const meta = useMemo(() => ({
    subject,
    gradeLevel,
    students,
  }), [subject, gradeLevel, students]);

  useEffect(() => {
    if (meta) {
      onMetaChange?.(meta);
    }
  }, [meta, onMetaChange]);

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
        const response = await fetch("/api/master_teacher/coordinator/students", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            subject,
            ids,
          }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "Failed to delete students");
        }
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

    const normalizedNewLrn = normalizeLrn(data.lrn?.trim());
    const existingWithSameLrn = normalizedNewLrn
      ? students.find(
          (student) =>
            normalizeLrn(student.lrn) === normalizedNewLrn &&
            (!editingStudent || String(student.id) !== String(editingStudent.id)),
        )
      : null;

    if (existingWithSameLrn) {
      setDuplicateLrn(normalizedNewLrn);
      setDuplicateStudent(existingWithSameLrn);
      setShowModal(false);
      setShowDuplicateModal(true);
      return;
    }

    // Cross-grade validation: LRN must not exist in a different grade
    if (normalizedNewLrn) {
      try {
        const response = await fetch(`/api/master_teacher/coordinator/students?lrn=${encodeURIComponent(normalizedNewLrn)}`, {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (response.ok && payload?.data) {
          const record = payload.data as any;
          const existingGrade = normalizeGradeLabel(record.gradeLevel ?? record.grade ?? null);
          const intendedGrade = normalizeGradeLabel(effectiveGrade);
          const existingId = record.studentIdentifier ?? record.id ?? record.student_id ?? null;
          const editingId = editingStudent ? editingStudent.id : null;

          if (
            intendedGrade && existingGrade && intendedGrade !== existingGrade &&
            (!editingId || String(editingId) !== String(existingId ?? ""))
          ) {
            const name = formatStudentDisplayName(transformApiRecord(record));
            setCrossGradeLrn(normalizedNewLrn);
            setCrossGradeStudentName(name || "Existing student");
            setShowModal(false);
            setShowCrossGradeModal(true);
            return;
          }
        }
      } catch (err) {
        console.error("LRN cross-grade validation failed", err);
      }
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

  // Filter students based on search term and phonemic level
  const filteredStudents = students.filter((student) => {
    const matchSearch = searchTerm === "" || 
      student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.grade?.toString().includes(searchTerm.toLowerCase()) ||
      student.section?.toLowerCase().includes(searchTerm.toLowerCase());
      
    return matchSearch;
  });

  const phonemicOrder = useMemo(() => buildPhonemicOrder(subject), [subject]);

  const sortedStudents = useMemo(() => {
    const fallbackIndex = phonemicOrder.size + 1;
    const compareName = (a: CoordinatorStudent, b: CoordinatorStudent): number =>
      formatStudentDisplayName(a).localeCompare(formatStudentDisplayName(b), undefined, { sensitivity: "base" });
    const normalizeSortableLrn = (student: CoordinatorStudent): string | null => {
      const normalized = normalizeLrn(student.lrn);
      return normalized ? normalized.replace(/\D/g, "") : null;
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

      const aLabel = normalizePhonemicLabel(resolveStudentPhonemic(a, subject));
      const bLabel = normalizePhonemicLabel(resolveStudentPhonemic(b, subject));
      const aIndex = phonemicOrder.get(aLabel) ?? fallbackIndex;
      const bIndex = phonemicOrder.get(bLabel) ?? fallbackIndex;
      if (aIndex !== bIndex) {
        return sortBy === "phonemic_low_high" ? aIndex - bIndex : bIndex - aIndex;
      }
      return compareName(a, b);
    });
  }, [filteredStudents, phonemicOrder, sortBy, subject]);

  const tableRows = useMemo(() => (
    sortedStudents.map((student, idx) => ({
      ...student,
      no: idx + 1,
      name: formatStudentDisplayName(student),
      fullLrn: normalizeLrn(student.lrn) ?? "N/A",
      maskedLrn: maskLrnForDisplay(student.lrn),
      phonemic: resolveStudentPhonemic(student, subject),
    }))
  ), [sortedStudents, subject]);

  const handleExport = () => {
    if (tableRows.length === 0) {
      alert("No students available to export.");
      return;
    }

    const exportData = tableRows.map((student) => ({
      "No#": student.no,
      "Student ID": student.studentId ?? "",
      "LRN (Masked)": student.maskedLrn,
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

        const normalizeHeader = (value: string) => value.trim().replace(/\s+/g, " ").toUpperCase();

        const readField = (row: any, keys: string[]): string => {
          const normalizedRow: Record<string, any> = {};
          for (const [rawKey, rawValue] of Object.entries(row ?? {})) {
            normalizedRow[normalizeHeader(String(rawKey))] = rawValue;
          }

          for (const key of keys) {
            const normalizedKey = normalizeHeader(key);
            if (normalizedRow[normalizedKey] !== undefined && normalizedRow[normalizedKey] !== null) {
              const value = String(normalizedRow[normalizedKey]).trim();
              if (value.length > 0) return value;
            }
          }
          return '';
        };

        const newStudents = jsonData.map((row: any) => {
          const firstName = readField(row, ['FIRSTNAME', 'FIRST_NAME', 'FIRST NAME', 'First Name', 'firstName']);
          const middleName = readField(row, ['MIDDLENAME', 'MIDDLE_NAME', 'MIDDLE NAME', 'Middle Name', 'middleName']);
          const lastName = readField(row, ['SURNAME', 'LASTNAME', 'LAST_NAME', 'LAST NAME', 'Last Name', 'lastName']);
          const suffix = readField(row, ['SUFFIX', 'Suffix', 'suffix']);
          const studentName = `${firstName} ${middleName} ${lastName} ${suffix}`.trim();

          const lrn = readField(row, ['LRN', 'Lrn', 'lrn']);

          const guardianFirst = readField(row, [
            "GUARDIAN'S FIRSTNAME",
            "GUARDIAN FIRSTNAME",
            "Guardian First Name",
            'guardianFirstName',
            "PARENT FIRST NAME",
            "PARENT_FIRST_NAME",
            "PARENT FIRSTNAME",
            "Parent First Name",
            "parentFirstName",
          ]);
          const guardianMiddle = readField(row, [
            "GUARDIAN'S MIDDLENAME",
            "GUARDIAN MIDDLENAME",
            "Guardian Middle Name",
            'guardianMiddleName',
            "PARENT MIDDLE NAME",
            "PARENT_MIDDLE_NAME",
            "PARENT MIDDLENAME",
            "Parent Middle Name",
            "parentMiddleName",
          ]);
          const guardianLast = readField(row, [
            "GUARDIAN'S SURNAME",
            "GUARDIAN SURNAME",
            "Guardian Last Name",
            'guardianLastName',
            "PARENT LAST NAME",
            "PARENT_LAST_NAME",
            "PARENT SURNAME",
            "Parent Last Name",
            "parentLastName",
          ]);
          const guardianSuffix = readField(row, [
            "GUARDIAN SUFFIX",
            "GUARDIAN'S SUFFIX",
            "guardianSuffix",
            "PARENT SUFFIX",
            "PARENT_SUFFIX",
            "Parent Suffix",
            "parentSuffix",
          ]);
          const guardianName = `${guardianFirst} ${guardianMiddle} ${guardianLast} ${guardianSuffix}`.trim();

          const subjectPhonemic = readField(row, ['SUBJECT PHONEMIC', 'Subject Phonemic', 'subjectPhonemic', 'PHONEMIC', 'Phonemic']);
          const gradeFromSheet = readField(row, ['GRADE', 'Grade', 'grade']);
          const resolvedGrade = normalizeGradeLabel(assignedGrade ?? gradeFromSheet) ?? "";

          return {
            studentId: readField(row, ['STUDENT ID', 'Student ID', 'studentId', 'ID']),
            lrn: lrn || undefined,
            firstName: firstName || '',
            middleName: middleName || '',
            lastName: lastName || '',
            suffix: suffix || '',
            name: studentName || 'Unnamed Student',
            grade: resolvedGrade,
            section: readField(row, ['SECTION', 'Section', 'section']),
            age: readField(row, ['AGE', 'Age', 'age']),
            address: readField(row, ['ADDRESS', 'Address', 'address']),
            guardian: guardianName || '',
            guardianFirstName: guardianFirst || '',
            guardianMiddleName: guardianMiddle || '',
            guardianLastName: guardianLast || '',
            guardianSuffix: guardianSuffix || '',
            guardianContact: readField(row, [
              "GUARDIAN'S CONTACT",
              "GUARDIAN'S CONTACT NUMBER",
              'CONTACT NUMBER',
              'CONTACT_NUMBER',
              'Contact Number',
              'contactNumber',
              'GUARDIAN CONTACT',
              'Guardian Contact',
              'GUARDIAN_CONTACT',
              'guardianContact',
              'PHONE NUMBER',
              'PHONE_NUMBER',
              'Phone Number',
              'phoneNumber',
            ]),
            guardianEmail: readField(row, ['EMAIL', 'Email', 'email']),
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
  const hasActiveSortOrFilter = sortBy !== DEFAULT_STUDENT_SORT;
  const handleClearAll = () => {
    setSortBy(DEFAULT_STUDENT_SORT);
  };

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {filteredStudents.length}
          {loading && <span className="ml-2 text-xs text-gray-400">Loading...</span>}
        </p>
        {error && <span className="text-sm text-red-600">{error}</span>}
        
        <div className="flex flex-row sm:flex-row sm:items-center gap-3 ">
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
            <>
              <SortMenu
                small
                align="right"
                value={sortBy}
                items={STUDENT_SORT_ITEMS}
                onChange={setSortBy}
                onClearAll={handleClearAll}
                clearAllDisabled={!hasActiveSortOrFilter}
                disabled={loading}
                iconOnly
                buttonLabel="Sort"
                buttonAriaLabel="Open sort options"
              />
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
                      Add Students
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
                      <ImportStudentsIcon />
                      Import Students
                    </button>
                    <div className="my-1 border-t border-gray-200" />
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
                      <ExportStudentListIcon />
                      Export Student List
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = "/masterteacher/coordinator/students/Student List Template.xlsx";
                        link.download = "Student List Template.xlsx";
                        link.click();
                        close();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50"
                    >
                      <ExportTemplateIcon />
                      Export Template
                    </button>
                    <div className="my-1 border-t border-gray-200" />
                    <button
                      disabled={actionsDisabled || assignStudentsDisabled || !onAssignStudents}
                      onClick={() => {
                        if (actionsDisabled || assignStudentsDisabled || !onAssignStudents) return;
                        onAssignStudents();
                        close();
                      }}
                      className={`w-full px-4 py-2 text-left text-sm text-[#013300] flex items-center gap-2 ${
                        actionsDisabled || assignStudentsDisabled || !onAssignStudents
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      Assign Students
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
            </>
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
      <DeleteConfirmationModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        onConfirm={() => setShowDuplicateModal(false)}
        title="Duplicate LRN Detected"
        message={
          duplicateLrn
            ? `LRN ${duplicateLrn} already exists for the ${subject} list. Please verify the LRN and try again.`
            : "This LRN already exists for this subject."
        }
        itemName={duplicateStudent ? formatStudentDisplayName(duplicateStudent) : undefined}
        confirmLabel="Close"
        showCancel={false}
      />
      <DeleteConfirmationModal
        isOpen={showCrossGradeModal}
        onClose={() => setShowCrossGradeModal(false)}
        onConfirm={() => setShowCrossGradeModal(false)}
        title="Duplicate LRN Detected"
        message={
          crossGradeLrn
            ? `LRN ${crossGradeLrn} already exists in a different grade level. Please verify the LRN and try again.`
            : "This LRN already exists in another grade and cannot be added here."
        }
        itemName={crossGradeStudentName ?? undefined}
        confirmLabel="Close"
        showCancel={false}
      />
    </div>
  );
}
