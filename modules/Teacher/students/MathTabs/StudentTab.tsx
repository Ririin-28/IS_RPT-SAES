import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import * as XLSX from 'xlsx';
import AddStudentModal from "../Modals/AddStudentModal";
import StudentDetailModal from "../Modals/StudentDetailModal"; // Import the modal
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
  students: any[];
  setStudents: React.Dispatch<React.SetStateAction<any[]>>;
  searchTerm: string;
}

export default function StudentTab({ students, setStudents, searchTerm }: StudentTabProps) {
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
    const filename = `Teacher_Math_Students_${timestamp}.xlsx`;
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

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {filteredStudents.length}
        </p>
        
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