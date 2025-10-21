"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { FaFileWord } from "react-icons/fa";

type ReportFile = {
  id: number;
  name: string;
  uploadedAt: string;
  teacher: string;
  section: string;
  grade: string;
  url: string;
};

const initialFiles: ReportFile[] = [
  {
    id: 1,
    name: "Math Progress Report",
    uploadedAt: "2024-01-15",
    teacher: "Michael Lopez",
    section: "A",
    grade: "Grade 4",
    url: "#"
  },
  {
    id: 2,
    name: "Reading Progress Report",
    uploadedAt: "2024-01-20",
    teacher: "Tina Esteban",
    section: "B",
    grade: "Grade 4",
    url: "#"
  },
  {
    id: 3,
    name: "Filipino Progress Report",
    uploadedAt: "2024-01-25",
    teacher: "Christiano Morales",
    section: "C",
    grade: "Grade 4",
    url: "#"
  }
];

const sections = ["All Sections", "A", "B", "C"];
const sortOptions = ["Newest first", "Oldest first", "Name (A-Z)", "Name (Z-A)"];

interface Props {
  reports: any[];
  setReports: (reports: any[]) => void;
  selectedMonth: string;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
}

// Custom Dropdown Component for filters
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
        className="flex items-center justify-between pl-3 pr-8 py-1.5 text-sm font-medium text-gray-700 cursor-pointer focus:outline-none border border-gray-300 rounded bg-white"
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

export default function GradeFourTab({
  reports: _reports,
  setReports: _setReports,
  selectedMonth,
  searchTerm,
  onSearchTermChange
}: Props) {
  const [files] = useState(initialFiles);
  const [filter, setFilter] = useState({
    section: "All Sections",
  });
  const [sortBy, setSortBy] = useState("Newest first");

  const normalizedMonth = useMemo(() => selectedMonth.toLowerCase(), [selectedMonth]);

  const filteredFiles = files.filter((file) => {
    const matchSection = filter.section === "All Sections" || file.section === filter.section;
    const matchSearch = searchTerm === "" || 
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.teacher.toLowerCase().includes(searchTerm.toLowerCase());
    const parsedDate = new Date(file.uploadedAt);
    const monthLabel = Number.isNaN(parsedDate.getTime())
      ? ""
      : parsedDate.toLocaleString('en-US', { month: 'long' }).toLowerCase();
    const matchMonth = normalizedMonth === "monthly" || monthLabel === normalizedMonth;
      
    return matchSection && matchSearch && matchMonth;
  });

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (sortBy === "Newest first") {
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    } else if (sortBy === "Oldest first") {
      return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
    } else if (sortBy === "Name (A-Z)") {
      return a.name.localeCompare(b.name);
    } else if (sortBy === "Name (Z-A)") {
      return b.name.localeCompare(a.name);
    }
    return 0;
  });

  const clearFilters = () => {
    setFilter({
      section: "All Sections",
    });
    onSearchTermChange("");
    setSortBy("Newest first");
  };

  function formatDateTime(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <div className="flex flex-row justify-between items-center mb-4">
            <p className="text-gray-600 text-md font-medium">
              Total: {filteredFiles.length}
            </p>
            
            <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-2 w-fit">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="whitespace-nowrap">Section:</span>
                <CustomDropdown 
                  options={sections}
                  value={filter.section}
                  onChange={(value) => setFilter({ section: value })}
                />
              </div>
              
              <div className="h-4 w-px bg-gray-300"></div>
              
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="whitespace-nowrap">Sort by:</span>
                <CustomDropdown 
                  options={sortOptions}
                  value={sortBy}
                  onChange={setSortBy}
                />
              </div>
            </div>
          </div>

          {sortedFiles.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <FaFileWord className="mx-auto text-gray-400 text-4xl mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No reports found</h3>
              <p className="text-gray-500 mb-4">
                Try adjusting your filters or search term to find what you're looking for.
              </p>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-lg shadow"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {sortedFiles.map((file) => (
                <div
                  key={file.id}
                  className="bg-white rounded-xl shadow hover:shadow-lg transition p-4 flex flex-col border border-gray-200 cursor-pointer min-h-[240px] relative group"
                >
                  <button className="absolute top-3 right-3 p-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M12 15V3"/>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <path d="m7 10 5 5 5-5"/>
                    </svg>
                  </button>
                  <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center mb-4 overflow-hidden">
                    <FaFileWord className="text-blue-600 text-5xl" />
                  </div>
                  <div className="font-semibold text-black text-base mb-3 line-clamp-2" title={file.name}>
                    {file.name}
                  </div>
                  <div className="text-xs text-gray-600 space-y-1 w-full mt-auto">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Teacher:</span> {file.teacher}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Section:</span> {file.section}
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <span className="font-medium">Uploaded:</span> {formatDateTime(file.uploadedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}