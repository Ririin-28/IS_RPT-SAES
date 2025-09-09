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
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";
// Text Components
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
import BodyLabel from "@/components/Common/Texts/BodyLabel";

interface TeacherTabProps {
  teachers: any[];
  setTeachers: React.Dispatch<React.SetStateAction<any[]>>;
}

export default function TeacherTab({ teachers, setTeachers }: TeacherTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTeachers, setSelectedTeachers] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [showKebabMenu, setShowKebabMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const kebabRef = useRef<HTMLDivElement>(null);

  // React Hook Form setup
  // Close kebab menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (kebabRef.current && !kebabRef.current.contains(event.target as Node)) {
        setShowKebabMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTeachers(new Set(teachers.map(t => t.id)));
    } else {
      setSelectedTeachers(new Set());
    }
  };

  // Handle select mode
  const handleEnterSelectMode = () => {
    setSelectMode(true);
    setShowKebabMenu(false);
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
      <div
        className="
        /* Mobile */
        flex flex-row justify-between items-center mb-4
        /* Tablet */
        sm:mb-6
        /* Desktop */
        md:mb-2
      "
      >
        <TertiaryHeader title={`Total: ${teachers.length}`} />
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <SecondaryButton small onClick={handleCancelSelect}>
                Cancel
              </SecondaryButton>
              {selectedTeachers.size > 0 && (
                <>
<DangerButton small onClick={handleDeleteSelected} className="flex items-center gap-1">
  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
  </svg>
  Delete ({selectedTeachers.size})
</DangerButton>
                </>
              )}
            </>
          ) : (
            <div className="relative" ref={kebabRef}>
              <UtilityButton small onClick={() => setShowKebabMenu(!showKebabMenu)}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              </UtilityButton>
              {showKebabMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <button
                    onClick={() => {
                      setShowModal(true);
                      setShowKebabMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Teacher
                  </button>
                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                      setShowKebabMenu(false);
                    }}
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
                    onClick={handleEnterSelectMode}
                    className="w-full px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                    Select
                  </button>
                </div>
              )}
            </div>
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
        data={teachers.map((teacher, idx) => ({
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