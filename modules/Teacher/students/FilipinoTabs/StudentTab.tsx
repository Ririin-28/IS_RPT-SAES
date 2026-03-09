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
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import { resolveRemedialPlayTarget } from "@/lib/utils/remedial-play";

const PHONEMIC_LEVELS = ["Non-Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"];

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

// Define types for name parts
type NameParts = {
  firstName: string;
  lastName: string;
  middleNames: string[];
};

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

// Extract name parts from student object
const extractNameParts = (student: any): NameParts => {
  const firstName = (student?.firstName ?? student?.firstname ?? "").trim();
  const lastName = (student?.lastName ?? student?.surname ?? student?.lastname ?? "").trim();
  const middleNameRaw = (student?.middleName ?? student?.middlename ?? student?.middleInitial ?? "").trim();

  // If we have separate name fields, use them
  if (firstName || lastName) {
    const middleNames = middleNameRaw ? middleNameRaw.split(/\s+/).filter(Boolean) : [];
    return { firstName, lastName, middleNames };
  }

  // Otherwise, parse the full name
  const raw = (student?.name ?? "").trim();
  if (!raw) {
    return { firstName: "", lastName: "", middleNames: [] };
  }
  
  const parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return { firstName: "", lastName: "", middleNames: [] };
  }
  
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "", middleNames: [] };
  }
  
  // Assume format: FirstName MiddleName LastName
  return {
    firstName: parts[0],
    lastName: parts[parts.length - 1],
    middleNames: parts.slice(1, -1),
  };
};

// Format display name as "Surname, FirstName M.I."
const formatStudentDisplayName = (student: any) => {
  const { firstName, lastName, middleNames } = extractNameParts(student);
  
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
  
  // Format as "Surname, FirstName M.I."
  if (segments.length === 1) {
    return segments[0];
  } else if (segments.length === 2) {
    return `${segments[0]}, ${segments[1]}`;
  } else {
    return `${segments[0]}, ${segments[1]} ${segments.slice(2).join(" ")}`;
  }
};

// Build sort key for A-Z sorting by Surname, FirstName, Middle Initials
const buildNameSortKey = (student: any) => {
  const { firstName, lastName, middleNames } = extractNameParts(student);
  
  // Create sort key: lastName|firstName|middleNames
  const normalized = [
    lastName.toLowerCase(),
    firstName.toLowerCase(),
    middleNames.join(" ").toLowerCase(),
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
  const [sortBy, setSortBy] = useState<StudentSortKey>(DEFAULT_STUDENT_SORT);
  const [visibleLrnIds, setVisibleLrnIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lrnRevealTimersRef = useRef<Record<string, number>>({});
  const [playLoadingId, setPlayLoadingId] = useState<string | null>(null);
  const [promoteLoadingId, setPromoteLoadingId] = useState<string | null>(null);
  const [promotionRecommendationRefreshKey, setPromotionRecommendationRefreshKey] = useState(0);

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

  // Filter students based on search term
  const filteredStudents = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();
    return students.filter((student) => {
      // Search in formatted name for better matching
      const formattedName = formatStudentDisplayName(student).toLowerCase();
      const matchSearch =
        searchValue === "" ||
        formattedName.includes(searchValue) ||
        student.studentId?.toString().toLowerCase().includes(searchValue) ||
        student.grade?.toString().toLowerCase().includes(searchValue) ||
        student.section?.toLowerCase().includes(searchValue);
      
      return matchSearch;
    });
  }, [students, searchTerm]);

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
      String(student?.filipinoPhonemic ?? student?.filipino ?? "").trim();

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

  const hasActiveSortOrFilter = sortBy !== DEFAULT_STUDENT_SORT;
  const handleClearAll = () => {
    setSortBy(DEFAULT_STUDENT_SORT);
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
      alert("No students available to export.");
      return;
    }

    const exportData = sortedStudents.map((student, index) => ({
      "No#": index + 1,
      "Student ID": student.studentId ?? "",
      "Full Name": formatStudentDisplayName(student),
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
    const filename = `Teacher_Filipino_Students_${timestamp}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

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
      alert('Please upload only Excel files (.xlsx or .xls)');
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
        alert(`Successfully imported ${newStudents.length} students`);
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

  const handlePlayClick = (student: any) => {
    const run = async () => {
      const studentId = student?.studentId ?? student?.id ?? "";
      if (!studentId) {
        alert("Student ID is missing.");
        return;
      }

      const phonemicLevel = String(student?.filipinoPhonemic ?? student?.filipino ?? "").trim();
      if (!phonemicLevel) {
        alert("Student phonemic level is missing.");
        return;
      }

      setPlayLoadingId(String(studentId));
      try {
        const result = await resolveRemedialPlayTarget({
          subject: "Filipino",
          basePath: "/Teacher/remedial",
          studentId: String(studentId),
          studentPhonemicLevel: phonemicLevel,
          studentGrade: student?.grade ?? null,
          userId,
        });

        if ("error" in result) {
          alert(result.error);
          return;
        }

        router.push(result.playPath);
      } catch (error) {
        console.error("Failed to start remedial session", error);
        alert("Unable to start remedial session.");
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
        alert("Student ID is missing.");
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
        const response = await fetch("/api/teacher/students/promote-phonemic", {
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
        alert(error instanceof Error ? error.message : "Failed to promote student.");
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
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 ">
          <SortMenu
            small
            iconOnly
            align="right"
            value={sortBy}
            items={STUDENT_SORT_ITEMS}
            onChange={setSortBy}
            onClearAll={handleClearAll}
            clearAllDisabled={!hasActiveSortOrFilter}
            buttonAriaLabel="Open sort options"
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
            ? `/Teacher/report/filipino/students/${encodeURIComponent(String(selectedStudent.studentId ?? selectedStudent.id ?? ""))}`
            : undefined
        }
        promotionRecommendationApiPath="/api/teacher/students/promotion-readiness"
        promotionRecommendationRefreshKey={promotionRecommendationRefreshKey}
        onPromote={handlePromoteFromModal}
        promoteLoading={
          !selectedStudent ||
          promoteLoadingId === String(selectedStudent?.studentId ?? selectedStudent?.id ?? "")
        }
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
        data={sortedStudents.map((student, idx) => ({
          ...student,
          name: formatStudentDisplayName(student), // Display as "Surname, FirstName M.I."
          fullLrn: normalizeLrn(student.lrn) ?? "N/A",
          maskedLrn: maskLrnForDisplay(student.lrn),
          phonemic: student.filipinoPhonemic ?? student.filipino ?? "",
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <div className="flex gap-2">
            <UtilityButton small onClick={() => handleViewDetails(row)} title="View student details">
              View
            </UtilityButton>
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
    </div>
  );
}
