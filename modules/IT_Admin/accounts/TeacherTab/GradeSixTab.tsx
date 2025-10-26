import { useState, useRef, useEffect, useCallback, useMemo, type ChangeEvent } from "react";
import * as XLSX from 'xlsx';
import TableList from "@/components/Common/Tables/TableList";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import DeleteConfirmationModal from "@/components/Common/Modals/DeleteConfirmationModal";
import AccountActionsMenu, { type AccountActionKey } from "../components/AccountActionsMenu";
import AddTeacherModal from "./Modals/AddTeacherModal";
import TeacherDetailsModal from "./Modals/TeacherDetailsModal";

const sections = ["All Sections", "A", "B", "C"];

interface GradeSixTabProps {
  teachers: any[];
  setTeachers: (teachers: any[]) => void;
  searchTerm: string;
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

export default function TeacherGradeSixTab({ teachers, setTeachers, searchTerm }: GradeSixTabProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filter, setFilter] = useState({ section: "All Sections" });
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTeacherKeys, setSelectedTeacherKeys] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const getTeacherKey = useCallback((teacher: any) => {
    const fallbackIndex = teachers.indexOf(teacher);
    return String(teacher.id ?? teacher.teacherId ?? teacher.email ?? teacher.contactNumber ?? teacher.name ?? fallbackIndex);
  }, [teachers]);

  const handleMenuAction = useCallback((action: AccountActionKey) => {
    if (action === "teacher:upload") {
      uploadInputRef.current?.click();
      return;
    }
    if (action === "teacher:add") {
      setShowAddModal(true);
      return;
    }
    if (action === "teacher:select") {
      setSelectMode(true);
      return;
    }
    console.log(`[Teacher Grade 6] Action triggered: ${action}`);
  }, []);

  const handleAddTeacher = useCallback((newTeacher: any) => {
    const normalized = {
      ...newTeacher,
      id: newTeacher.id ?? newTeacher.teacherId ?? Date.now(),
    };
    setTeachers([...teachers, normalized]);
  }, [teachers, setTeachers]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
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
  }, []);

  const handleUploadConfirm = useCallback(() => {
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
          const fullName = `${row.FIRSTNAME || ''} ${row.MIDDLENAME || ''} ${row.SURNAME || ''}`.trim();
          
          return {
            id: Date.now() + index,
            teacherId: row['TEACHER ID'] || '',
            name: fullName,
            email: row['EMAIL'] || '',
            contactNumber: row['CONTACT NUMBER'] || '',
            grade: 6, // Force grade 6 for Grade Six tab
            section: row['SECTION'] || '',
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
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  }, [selectedFile, teachers, setTeachers]);

  const handleUploadCancel = useCallback(() => {
    setSelectedFile(null);
    setShowConfirmModal(false);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  }, []);

  const gradeSixTeachers = teachers.filter(teacher => 
    teacher.grade === 6 || teacher.grade === "6"
  );

  const filteredTeachers = useMemo(() => gradeSixTeachers.filter((teacher) => {
    const matchSection = filter.section === "All Sections" || teacher.section === filter.section;
    const matchSearch = searchTerm === "" || 
      teacher.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.teacherId?.toLowerCase().includes(searchTerm.toLowerCase());
      
    return matchSection && matchSearch;
  }), [gradeSixTeachers, filter.section, searchTerm]);

  const handleShowDetails = (teacher: any) => {
    setSelectedTeacher(teacher);
    setShowDetailModal(true);
  };

  const handleSelectTeacher = useCallback((id: string, checked: boolean) => {
    setSelectedTeacherKeys((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      const keys = new Set(filteredTeachers.map((teacher: any) => getTeacherKey(teacher)));
      setSelectedTeacherKeys(keys);
      return;
    }
    setSelectedTeacherKeys(new Set());
  }, [filteredTeachers, getTeacherKey]);

  const handleCancelSelect = useCallback(() => {
    setSelectMode(false);
    setSelectedTeacherKeys(new Set());
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedTeacherKeys.size === 0) return;
    setShowDeleteModal(true);
  }, [selectedTeacherKeys]);

  const handleConfirmDeleteSelected = useCallback(() => {
    const remaining = teachers.filter((teacher: any) => !selectedTeacherKeys.has(getTeacherKey(teacher)));
    setTeachers(remaining);
    setSelectedTeacherKeys(new Set());
    setSelectMode(false);
    setShowDeleteModal(false);
  }, [teachers, selectedTeacherKeys, getTeacherKey, setTeachers]);

  const handleCloseDeleteModal = useCallback(() => {
    setShowDeleteModal(false);
  }, []);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {gradeSixTeachers.length}
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
          <div className="flex items-center justify-end gap-3">
            {selectMode ? (
              <>
                <SecondaryButton small onClick={handleCancelSelect}>
                  Cancel
                </SecondaryButton>
                <DangerButton
                  small
                  onClick={handleDeleteSelected}
                  disabled={selectedTeacherKeys.size === 0}
                  className={selectedTeacherKeys.size === 0 ? "opacity-60 cursor-not-allowed" : ""}
                >
                  Delete ({selectedTeacherKeys.size})
                </DangerButton>
              </>
            ) : (
              <AccountActionsMenu
                accountType="Teachers"
                onAction={handleMenuAction}
                buttonAriaLabel="Open teacher actions"
              />
            )}
            <input
              ref={uploadInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
      </div>
      
      <TeacherDetailsModal
        show={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        teacher={selectedTeacher}
      />

      <AddTeacherModal
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddTeacher}
      />

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleUploadCancel}
        onConfirm={handleUploadConfirm}
        title="Confirm File Upload"
        message="Are you sure you want to upload this Excel file? This will import teacher data."
        fileName={selectedFile?.name}
      />

      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "teacherId", title: "Teacher ID" },
          { key: "name", title: "Full Name" },
          { key: "email", title: "Email" },
          { key: "contactNumber", title: "Contact Number" },
        ]}
        data={filteredTeachers.map((teacher: any, idx: number) => ({
          ...teacher,
          id: getTeacherKey(teacher),
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <UtilityButton small onClick={() => handleShowDetails(row)}>
            View Details
          </UtilityButton>
        )}
        selectable={selectMode}
        selectedItems={selectedTeacherKeys}
        onSelectAll={handleSelectAll}
        onSelectItem={(id, checked) => handleSelectTeacher(String(id), checked)}
        pageSize={10}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDeleteSelected}
        title="Confirm Delete Selected"
        message={`Are you sure you want to delete ${selectedTeacherKeys.size} selected teacher${selectedTeacherKeys.size === 1 ? "" : "s"}? This action cannot be undone.`}
      />
    </div>
  );
}