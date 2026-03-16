import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import TeacherDetailModal from "../Modals/TeacherDetailModal";
import type { CoordinatorTeacher } from "../useCoordinatorTeachers";
// Button Components

import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import SortMenu, { type SortMenuItem } from "@/components/Common/Menus/SortMenu";


import TableList from "@/components/Common/Tables/TableList";

interface TeacherTabProps {
  teachers: CoordinatorTeacher[];
  searchTerm: string;
}

type TeacherSortKey = "default" | "name_asc" | "name_desc" | "id_asc" | "id_desc";

const TEACHER_SORT_ITEMS: SortMenuItem<TeacherSortKey>[] = [
  { value: "default", label: "Default Order" },
  { type: "separator", id: "name" },
  { value: "name_asc", label: "Name (A-Z)" },
  { value: "name_desc", label: "Name (Z-A)" },
  { type: "separator", id: "id" },
  { value: "id_asc", label: "Teacher ID (Asc)" },
  { value: "id_desc", label: "Teacher ID (Desc)" },
];

const ExportIcon = () => (
  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14" />
  </svg>
);

export default function TeacherTab({ teachers, searchTerm }: TeacherTabProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [sortBy, setSortBy] = useState<TeacherSortKey>("default");



  // Filter teachers based on search term
  const filteredTeachers = teachers.filter((teacher) => {
    const matchSearch = searchTerm === "" || 
      teacher.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.teacherId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.contactNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      
    return matchSearch;
  });



  const sortedTeachers = useMemo(() => {
    if (sortBy === "default") {
      return filteredTeachers;
    }

    const byName = (a: CoordinatorTeacher, b: CoordinatorTeacher) =>
      (a.name ?? "").localeCompare((b.name ?? ""), undefined, { sensitivity: "base" });

    const byTeacherId = (a: CoordinatorTeacher, b: CoordinatorTeacher) =>
      (a.teacherId ?? "").localeCompare((b.teacherId ?? ""), undefined, { numeric: true, sensitivity: "base" });

    return [...filteredTeachers].sort((a, b) => {
      if (sortBy === "name_asc") return byName(a, b);
      if (sortBy === "name_desc") return byName(b, a);
      if (sortBy === "id_asc") return byTeacherId(a, b);
      return byTeacherId(b, a);
    });
  }, [filteredTeachers, sortBy]);

  const utilityButtonClass =
    "inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2";

  const handleExport = () => {
    const rows = sortedTeachers.map((teacher, idx) => ({
      "No#": idx + 1,
      "Teacher ID": teacher.teacherId ?? "",
      "Full Name": teacher.name ?? "",
      Email: teacher.email ?? "",
      "Contact Number": teacher.contactNumber ?? "",
    }));

    if (rows.length === 0) {
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Teachers");

    const timestamp = new Date().toISOString().replace(/[:.-]/g, "");
    XLSX.writeFile(workbook, `Coordinator_Teachers_${timestamp}.xlsx`);
  };

  // Show teacher details
  const handleShowDetails = (teacher: any) => {
    setSelectedTeacher(teacher);
    setShowDetailModal(true);
  };



  return (
    <div>
      {/* Top Bar: Total */}
      <div className="flex flex-row justify-between items-center mb-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {sortedTeachers.length}
        </p>
        <div className="flex items-center gap-2">
          <SortMenu
            small
            align="right"
            value={sortBy}
            items={TEACHER_SORT_ITEMS}
            onChange={setSortBy}
            iconOnly
            buttonLabel="Sort"
            buttonAriaLabel="Sort"
            buttonTitle="Sort"
            iconButtonClassName={utilityButtonClass}
            iconClassName="h-4.5 w-4.5"
          />
          <button
            type="button"
            onClick={handleExport}
            className={utilityButtonClass}
            aria-label="Export to Excel"
            title="Export to Excel"
          >
            <ExportIcon />
          </button>
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
        showFullScreenToggle
        columns={[
          { key: "no", title: "No#" },
          { key: "name", title: "Full Name" },
          { key: "email", title: "Email" },
          { key: "contactNumber", title: "Contact Number" },
        ]}
        data={sortedTeachers.map((teacher, idx) => ({
          ...teacher,
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <button
            type="button"
            onClick={() => handleShowDetails(row)}
            title="View teacher details"
            className="inline-flex h-10 items-center rounded-lg border border-emerald-700 bg-white px-4 text-sm font-semibold text-emerald-800 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 hover:bg-emerald-50"
          >
            View
          </button>
        )}
        pageSize={10}
      />
    </div>
  );
}
