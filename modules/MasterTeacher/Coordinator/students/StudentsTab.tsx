import { useState, useRef, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import * as XLSX from 'xlsx';
import AddStudentModal, { type AddStudentFormValues } from "./Modals/AddStudentModal";
import StudentDetailModal from "./Modals/StudentDetailModal"; // Import the modal
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
import DeleteConfirmationModal from "@/components/Common/Modals/DeleteConfirmationModal";
// Button Components
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";
import KebabMenu from "@/components/Common/Menus/KebabMenu";
// Text Components
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
import BodyLabel from "@/components/Common/Texts/BodyLabel";
import type { CoordinatorStudent } from "./useCoordinatorStudents";

const sections = ["All Sections", "A", "B", "C"];

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
  students: CoordinatorStudent[];
  searchTerm: string;
  subjectLabel: string;
  gradeLabel: string | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  onAddStudent: (input: CoordinatorStudentFormInput) => Promise<void>;
  onImportStudents: (inputs: CoordinatorStudentFormInput[]) => Promise<void>;
  onDeleteStudents: (ids: number[]) => Promise<void>;
  onRefresh: () => Promise<void>;
}

type CoordinatorStudentFormInput = {
  studentId?: string;
  name: string;
  grade?: string;
  section?: string;
  age?: string;
  address?: string;
  guardian?: string;
  guardianContact?: string;
  relationship?: string;
  englishPhonemic?: string;
  filipinoPhonemic?: string;
  mathProficiency?: string;
};

export default function StudentTab({
  students,
  searchTerm,
  subjectLabel,
  gradeLabel,
  loading,
  saving,
  error,
  onAddStudent,
  onImportStudents,
  onDeleteStudents,
  onRefresh,
}: StudentTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [filter, setFilter] = useState({ section: "All Sections" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildDefaultValues = useCallback((): AddStudentFormValues => ({
    studentId: "",
    role: "Student",
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    grade: gradeLabel?.trim() ?? "",
    section: "",
    guardianFirstName: "",
    guardianMiddleName: "",
    guardianLastName: "",
    guardianSuffix: "",
    relationship: "",
    guardianContact: "",
    address: "",
    englishPhonemic: "",
    filipinoPhonemic: "",
    mathPhonemic: "",
  }), [gradeLabel]);

  // React Hook Form setup
  const formMethods = useForm<AddStudentFormValues>({
    defaultValues: buildDefaultValues(),
  });
  const { register, handleSubmit, reset, formState: { errors }, setValue } = formMethods;

  useEffect(() => {
    reset(buildDefaultValues());
  }, [buildDefaultValues, reset]);

  useEffect(() => {
    if (gradeLabel && gradeLabel.trim().length > 0) {
      setValue("grade", gradeLabel.trim(), { shouldDirty: false, shouldTouch: false, shouldValidate: false });
    }
  }, [gradeLabel, setValue]);

  // Add new student
  const onSubmit = async (data: AddStudentFormValues) => {
    const effectiveGrade = gradeLabel && gradeLabel.trim().length > 0 ? gradeLabel.trim() : data.grade;
    if (!effectiveGrade || effectiveGrade.trim().length === 0) {
      alert("Grade level is required.");
      return;
    }
    try {
      const payload: CoordinatorStudentFormInput = {
        studentId: data.studentId || undefined,
        name: [data.firstName, data.middleName, data.lastName, data.suffix].filter((part) => part && part.trim().length > 0).join(" ") || "Unnamed Student",
        grade: effectiveGrade,
        section: data.section || undefined,
        age: undefined,
        address: data.address || undefined,
        guardian: [data.guardianFirstName, data.guardianMiddleName, data.guardianLastName, data.guardianSuffix]
          .filter((part) => part && part.trim().length > 0)
          .join(" ") || undefined,
        guardianContact: data.guardianContact || undefined,
        relationship: data.relationship || undefined,
        englishPhonemic: data.englishPhonemic || undefined,
        filipinoPhonemic: data.filipinoPhonemic || undefined,
        mathProficiency: data.mathPhonemic || undefined,
      };
      await onAddStudent(payload);
      reset();
      setShowModal(false);
    } catch (error) {
      console.error("Failed to add student", error);
      alert(error instanceof Error ? error.message : "Failed to add student.");
    }
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

  const handleExport = () => {
    if (filteredStudents.length === 0) {
      alert("No students available to export.");
      return;
    }

    const exportData = filteredStudents.map((student, index) => ({
      "No#": index + 1,
      "Student ID": student.studentId ?? "",
      "Full Name": student.name ?? "",
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
  const sanitizedSubject = subjectLabel.replace(/\s+/g, "");
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
      await onDeleteStudents(Array.from(selectedStudents));
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
    setSelectedStudent({ ...student, subjectAssigned: subjectLabel });
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
  const handleUploadConfirm = async () => {
    if (!selectedFile) return;

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

          const guardianFirst = readField(row, ["GUARDIAN'S FIRSTNAME", "GUARDIAN FIRSTNAME", "Guardian First Name", 'guardianFirstName']);
          const guardianMiddle = readField(row, ["GUARDIAN'S MIDDLENAME", "GUARDIAN MIDDLENAME", "Guardian Middle Name", 'guardianMiddleName']);
          const guardianLast = readField(row, ["GUARDIAN'S SURNAME", "GUARDIAN SURNAME", "Guardian Last Name", 'guardianLastName']);
          const guardianName = `${guardianFirst} ${guardianMiddle} ${guardianLast}`.trim();

          const subjectPhonemic = readField(row, ['SUBJECT PHONEMIC', 'Subject Phonemic', 'subjectPhonemic', 'PHONEMIC', 'Phonemic']);

          return {
            studentId: readField(row, ['STUDENT ID', 'Student ID', 'studentId', 'ID']),
            name: studentName || 'Unnamed Student',
            grade: readField(row, ['GRADE', 'Grade', 'grade']),
            section: readField(row, ['SECTION', 'Section', 'section']),
            age: readField(row, ['AGE', 'Age', 'age']),
            address: readField(row, ['ADDRESS', 'Address', 'address']),
            guardian: guardianName || '',
            guardianContact: readField(row, ["GUARDIAN'S CONTACT", "GUARDIAN'S CONTACT NUMBER", 'CONTACT NUMBER', 'CONTACT_NUMBER', 'Contact Number', 'contactNumber', 'GUARDIAN CONTACT', 'Guardian Contact', 'GUARDIAN_CONTACT', 'guardianContact']),
            relationship: readField(row, ['RELATIONSHIP', 'Relationship', 'relationship']),
            englishPhonemic: subjectLabel?.toLowerCase() === 'english' ? subjectPhonemic : '',
            filipinoPhonemic: subjectLabel?.toLowerCase() === 'filipino' ? subjectPhonemic : '',
            mathProficiency: subjectLabel?.toLowerCase() === 'math' ? subjectPhonemic : '',
          } satisfies CoordinatorStudentFormInput;
        });

        void onImportStudents(newStudents)
          .then(() => {
            alert(`Successfully imported ${newStudents.length} students`);
          })
          .catch((error) => {
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
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
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

      {/* Modal for Add Student Form */}
      <AddStudentModal
        show={showModal}
        onClose={() => {
          setShowModal(false);
          reset(buildDefaultValues());
        }}
        form={formMethods}
        onSubmit={onSubmit}
        isSubmitting={saving}
        apiError={error}
        subjectLabel={subjectLabel}
        gradeLabel={gradeLabel}
      />

      {/* Student Detail Modal */}
      <StudentDetailModal
        show={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        student={selectedStudent}
      />

      {/* Student Table Section */}
<TableList
  columns={[
    { key: "no", title: "No#" },
    { key: "studentId", title: "Student ID" },
    { key: "name", title: "Full Name" },
    { key: "grade", title: "Grade" },
    { key: "section", title: "Section" },
  ]}
  data={filteredStudents.map((student, idx) => ({
    ...student,
    no: idx + 1,
  }))}
  actions={(row: any) => (
    <UtilityButton small onClick={() => handleViewDetails(row)}>
      View Details
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