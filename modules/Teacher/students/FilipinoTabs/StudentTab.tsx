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
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
import BodyLabel from "@/components/Common/Texts/BodyLabel";

const sections = ["All Sections", "A", "B", "C"];

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
  const [filter, setFilter] = useState({ section: "All Sections" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  

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

  // Filter students based on search term and section
  const filteredStudents = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();
    return students.filter((student) => {
      const matchSection = filter.section === "All Sections" || student.section === filter.section;
      
      // Search in formatted name for better matching
      const formattedName = formatStudentDisplayName(student).toLowerCase();
      const matchSearch =
        searchValue === "" ||
        formattedName.includes(searchValue) ||
        student.studentId?.toString().toLowerCase().includes(searchValue) ||
        student.grade?.toString().toLowerCase().includes(searchValue) ||
        student.section?.toLowerCase().includes(searchValue);
      
      return matchSection && matchSearch;
    });
  }, [students, filter.section, searchTerm]);

  // Sort students A-Z by Surname, FirstName, Middle Initials
  const sortedStudents = useMemo(() => {
    const list = [...filteredStudents];
    list.sort((a, b) => {
      const aKey = buildNameSortKey(a);
      const bKey = buildNameSortKey(b);
      return aKey.localeCompare(bKey, undefined, { sensitivity: "base" });
    });
    return list;
  }, [filteredStudents]);

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

  const handlePlayClick = () => {
    router.push("/Teacher/remedial/FilipinoFlashcards?start=0");
  };

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {sortedStudents.length}
        </p>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 ">
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
            <span className="text-sm text-gray-700 whitespace-nowrap">Section:</span>
            <CustomDropdown 
              options={sections}
              value={filter.section}
              onChange={(value) => setFilter({ section: value })}
              className="min-w-[120px]"
            />
          </div>
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
        onClose={() => setShowDetailModal(false)}
        student={selectedStudent}
      />

      {/* Student Table Section */}
      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "studentId", title: "Student ID" },
          { key: "lrn", title: "LRN" },
          { key: "name", title: "Full Name" },
          { key: "phonemic", title: "Phonemic" },
        ]}
        data={sortedStudents.map((student, idx) => ({
          ...student,
          name: formatStudentDisplayName(student), // Display as "Surname, FirstName M.I."
          lrn: student.lrn ?? "",
          phonemic: student.filipinoPhonemic ?? student.filipino ?? "",
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <div className="flex gap-2">
            <UtilityButton small onClick={() => handleViewDetails(row)} title="View student details">
              View
            </UtilityButton>
            <UtilityButton small type="button" onClick={handlePlayClick} title="Click to play remedial session">
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