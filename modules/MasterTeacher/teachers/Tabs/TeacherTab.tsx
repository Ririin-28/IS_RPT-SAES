import { useState, useRef, useEffect } from "react";
import React from "react";
import { useForm } from "react-hook-form";
import * as XLSX from 'xlsx';
import AddTeacherModal from "../Modals/AddTeacherModal";
import TeacherDetailModal from "../Modals/TeacherDetailModal";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
import DeleteConfirmationModal from "@/components/Common/Modals/DeleteConfirmationModal";
// Button Components
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import KebabMenu from "@/components/Common/Menus/KebabMenu";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";
// Text Components
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
import BodyLabel from "@/components/Common/Texts/BodyLabel";

const sections = ["All Sections", "A", "B", "C"];

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

interface TeacherTabProps {
  teachers: any[];
  setTeachers: React.Dispatch<React.SetStateAction<any[]>>;
  searchTerm: string;
}

export default function TeacherTab({ teachers, setTeachers, searchTerm }: TeacherTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTeachers, setSelectedTeachers] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [filter, setFilter] = useState({ section: "All Sections" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const kebabRef = useRef<HTMLDivElement>(null);

  // React Hook Form setup
  // kebab menu visibility is now managed by the KebabMenu component

  const formMethods = useForm({
    defaultValues: {
      teacherId: "",
      name: "",
      grade: "",
      subject: "",
      email: "",
      contactNumber: "",
      sections: "",
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = formMethods;

  // Add new teacher
  const onSubmit = (data: any) => {
    const gradeNum = Number(data.grade);
    setTeachers([
      ...teachers,
      {
        id: Date.now(),
        ...data,
        grade: isNaN(gradeNum) ? "" : gradeNum,
      },
    ]);
    reset();
    setShowModal(false);
  };

  // Handle teacher selection
  const handleSelectTeacher = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedTeachers);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedTeachers(newSelected);
  };

  // Filter teachers based on search term and section
  const filteredTeachers = teachers.filter((teacher) => {
    const matchSection = filter.section === "All Sections" || teacher.sections?.includes(filter.section);
    const matchSearch = searchTerm === "" || 
      teacher.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.teacherId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.contactNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      
    return matchSection && matchSearch;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTeachers(new Set(filteredTeachers.map(t => t.id)));
    } else {
      setSelectedTeachers(new Set());
    }
  };

  // Handle select mode
  const handleEnterSelectMode = () => {
  setSelectMode(true);
  };

  const handleCancelSelect = () => {
    setSelectMode(false);
    setSelectedTeachers(new Set());
  };

  // Delete selected teachers
  const handleDeleteSelected = () => {
    if (selectedTeachers.size === 0) return;
    setPendingDeleteId(-2); // Use -2 for selected teachers
    setShowDeleteModal(true);
  };

  // Delete individual teacher (opens modal)
  const handleDelete = (id: number) => {
    setPendingDeleteId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (pendingDeleteId == null) return;
    if (pendingDeleteId === -2) {
      // Delete selected teachers
      setTeachers(teachers.filter(t => !selectedTeachers.has(t.id)));
      setSelectedTeachers(new Set());
      setSelectMode(false);
    } else {
      setTeachers(teachers.filter((s) => s.id !== pendingDeleteId));
    }
    setPendingDeleteId(null);
    setShowDeleteModal(false);
  };

  // Delete all teachers (opens modal)
  const handleDeleteAll = () => {
    setPendingDeleteId(-1); // special marker for delete all
    setShowDeleteModal(true);
  };

  // Show teacher details
  const handleShowDetails = (teacher: any) => {
    setSelectedTeacher(teacher);
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

        const newTeachers = jsonData.map((row: any, index: number) => {
          // Construct full name from the separate name fields
          const fullName = `${row.FIRSTNAME || ''} ${row.MIDDLENAME || ''} ${row.SURNAME || ''}`.trim();
          
          return {
            id: Date.now() + index,
            teacherId: row['TEACHER ID'] || '',
            name: fullName,
            surname: row['SURNAME'] || '',
            firstName: row['FIRSTNAME'] || '',
            middleName: row['MIDDLENAME'] || '',
            email: row['EMAIL'] || '',
            contactNumber: row['CONTACT NUMBER'] || '',
            grade: row['HANDLED GRADE'] || '',
            sections: row['HANDLED SECTIONS'] || '',
            subjects: row['HANDLED SUBJECTS'] || '',
          };
        });

        setTeachers([...teachers, ...newTeachers]);
        alert(`Successfully imported ${newTeachers.length} teachers`);
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
      {/* Top Bar: Total and Actions */}
      <div className="flex flex-row justify-between items-center mb-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {filteredTeachers.length}
        </p>
        
        <div className="flex items-center gap-3">
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
              {selectedTeachers.size > 0 && (
                <>
<DangerButton small onClick={handleDeleteSelected} className="flex items-center gap-1">
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-icon lucide-trash"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
  Delete ({selectedTeachers.size})
</DangerButton>
                </>
              )}
            </>
          ) : (
            <KebabMenu
              small
              align="right"
              renderItems={(close) => (
                <>
                  <button
                    onClick={() => { setShowModal(true); close(); }}
                    className="w-full px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Teacher
                  </button>
                  <button
                    onClick={() => { fileInputRef.current?.click(); close(); }}
                    className="w-full px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="m17 8-5-5-5 5" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    </svg>
                    Upload File
                  </button>
                  <button
                    onClick={() => { handleEnterSelectMode(); close(); }}
                    className="w-full px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                    Select
                  </button>
                </>
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
      
      {/* Add Teacher Modal */}
      <AddTeacherModal
        show={showModal}
        onClose={() => {
          setShowModal(false);
          reset();
        }}
        form={formMethods}
        onSubmit={onSubmit}
      />
      
      {/* Teacher Detail Modal */}
      <TeacherDetailModal
        show={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        teacher={selectedTeacher}
      />

      {/* Table */}
      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "teacherId", title: "Teacher ID" },
          { key: "name", title: "Full Name" },
          { key: "email", title: "Email" },
          { key: "contactNumber", title: "Contact Number" },
        ]}
        data={filteredTeachers.map((teacher, idx) => ({
          ...teacher,
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <UtilityButton small onClick={() => handleShowDetails(row)}>
            View Details
          </UtilityButton>
        )}
        selectable={selectMode}
        selectedItems={selectedTeachers}
        onSelectAll={handleSelectAll}
        onSelectItem={handleSelectTeacher}
        pageSize={10}
      />
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleUploadCancel}
        onConfirm={handleUploadConfirm}
        title="Confirm File Upload"
        message="Are you sure you want to upload this Excel file? This will import teacher data."
        fileName={selectedFile?.name}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setPendingDeleteId(null);
        }}
        onConfirm={() => {
          if (pendingDeleteId === -1) {
            setTeachers([]);
            setPendingDeleteId(null);
            setShowDeleteModal(false);
            return;
          }
          confirmDelete();
        }}
        title={pendingDeleteId === -1 ? "Confirm Delete All" : pendingDeleteId === -2 ? "Confirm Delete Selected" : "Confirm Delete"}
        message={
          pendingDeleteId === -1 
            ? "Are you sure you want to delete ALL teachers? This action cannot be undone." 
            : pendingDeleteId === -2
            ? `Are you sure you want to delete ${selectedTeachers.size} selected teacher${selectedTeachers.size > 1 ? 's' : ''}? This action cannot be undone.`
            : "Are you sure you want to delete this teacher?"
        }
        itemName={pendingDeleteId && pendingDeleteId > 0 ? teachers.find(t => t.id === pendingDeleteId)?.name : undefined}
      />
    </div>
  );
}