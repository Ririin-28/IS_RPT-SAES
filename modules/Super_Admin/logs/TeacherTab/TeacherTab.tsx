import { useMemo, useRef, useState, useEffect } from "react";
import TableList from "@/components/Common/Tables/TableList";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import UserDetailModal from "../Modals/UserDetailsModal";

const SECTIONS = ["All Sections", "A", "B", "C"] as const;
const GRADES = ["All Grades", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"] as const;

type SectionOption = (typeof SECTIONS)[number];
type GradeOption = (typeof GRADES)[number];

interface TeacherTabProps {
  teachers: any[];
  setTeachers: (teachers: any[]) => void;
  searchTerm: string;
}

interface CustomDropdownProps {
  options: readonly string[];
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
          className={`ml-2 h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
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
                option === value ? "bg-[#013300] text-white" : "text-gray-700 hover:bg-gray-100"
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

function normalizeGradeToken(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const match = String(value).match(/(\d+)/);
  return match ? match[1] : null;
}

export default function TeacherTab({ teachers, setTeachers, searchTerm }: TeacherTabProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [sectionFilter, setSectionFilter] = useState<SectionOption>("All Sections");
  const [gradeFilter, setGradeFilter] = useState<GradeOption>("All Grades");

  const filteredTeachers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const gradeToken = normalizeGradeToken(gradeFilter);

    return teachers.filter((teacher) => {
      const teacherGradeToken = normalizeGradeToken(
        teacher.grade ?? teacher.grade_id ?? teacher.gradeId ?? teacher.handledGrade ?? teacher.handled_grade,
      );

      if (gradeToken && teacherGradeToken !== gradeToken) {
        return false;
      }

      if (sectionFilter !== "All Sections" && teacher.section !== sectionFilter) {
        return false;
      }

      if (!query) return true;

      return (
        teacher.name?.toLowerCase().includes(query) ||
        teacher.email?.toLowerCase().includes(query) ||
        teacher.teacherId?.toLowerCase().includes(query)
      );
    });
  }, [teachers, searchTerm, gradeFilter, sectionFilter]);

  const handleShowDetails = (teacher: any) => {
    setSelectedTeacher(teacher);
    setShowDetailModal(true);
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <CustomDropdown
            options={GRADES}
            value={gradeFilter}
            onChange={(value) => setGradeFilter(value as GradeOption)}
            className="min-w-[140px]"
          />
          <CustomDropdown
            options={SECTIONS}
            value={sectionFilter}
            onChange={(value) => setSectionFilter(value as SectionOption)}
            className="min-w-[140px]"
          />
          <p className="text-gray-600 text-md font-medium">Total: {filteredTeachers.length}</p>
        </div>
      </div>

      <UserDetailModal show={showDetailModal} onClose={() => setShowDetailModal(false)} user={selectedTeacher} />

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
            View
          </UtilityButton>
        )}
        pageSize={10}
      />
    </div>
  );
}
