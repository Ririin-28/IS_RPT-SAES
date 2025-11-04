import { useState, useRef, useEffect } from "react";
import React from "react";
import TeacherDetailModal from "../Modals/TeacherDetailModal";
// Button Components

import UtilityButton from "@/components/Common/Buttons/UtilityButton";


import TableList from "@/components/Common/Tables/TableList";


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
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [filter, setFilter] = useState({ section: "All Sections" });



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



  // Show teacher details
  const handleShowDetails = (teacher: any) => {
    setSelectedTeacher(teacher);
    setShowDetailModal(true);
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
          

        </div>
      </div>
      
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
        pageSize={10}
      />

    </div>
  );
}