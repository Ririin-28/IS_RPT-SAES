import { useState, useRef, useEffect } from "react";
import TableList from "@/components/Common/Tables/TableList";

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
        className="flex items-center justify-between pl-3 pr-0 py-1.5 text-sm font-medium text-gray-700 cursor-pointer focus:outline-none border border-gray-300 rounded bg-white"
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

export default function MasterTeacherGradeSixTab({ teachers, setTeachers, searchTerm }: GradeSixTabProps) {
  const [filter, setFilter] = useState({ section: "All Sections" });

  const gradeSixTeachers = teachers.filter(teacher => 
    teacher.grade === 6 || teacher.grade === "6"
  );

  const filteredTeachers = gradeSixTeachers.filter((teacher) => {
    const matchSection = filter.section === "All Sections" || teacher.section === filter.section;
    const matchSearch = searchTerm === "" || 
      teacher.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.teacherId?.toLowerCase().includes(searchTerm.toLowerCase());
      
    return matchSection && matchSearch;
  });

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {gradeSixTeachers.length}
        </p>
        
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

      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "teacherId", title: "Teacher ID" },
          { key: "name", title: "Full Name" },
          { key: "email", title: "Email" },
          { key: "contactNumber", title: "Contact Number" },
          { key: "archivedDate", title: "Archived Date" },
        ]}
        data={filteredTeachers.map((teacher, idx) => ({
          ...teacher,
          no: idx + 1,
        }))}
        actions={() => <></>}
        pageSize={10}
      />
    </div>
  );
}