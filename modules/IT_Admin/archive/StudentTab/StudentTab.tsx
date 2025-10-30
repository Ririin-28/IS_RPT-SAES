import TableList from "@/components/Common/Tables/TableList";
import KebabMenu from "@/components/Common/Menus/KebabMenu";
import { exportArchiveRows } from "../utils/export-columns";

interface StudentTabProps {
  students: any[];
  searchTerm: string;
  selectedGrade: string;
}

const normalizeGrade = (grade: unknown) => {
  if (grade === null || grade === undefined) return "";
  if (typeof grade === "number") return grade.toString();
  return String(grade);
};

const ExportIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14" />
  </svg>
);

export default function StudentTab({ students, searchTerm, selectedGrade }: StudentTabProps) {
  const term = searchTerm.trim().toLowerCase();

  const filteredStudents = students.filter((student) => {
    const gradeMatches =
      selectedGrade === "All Grades" ||
      normalizeGrade(student?.grade ?? student?.grade) === selectedGrade.replace("Grade ", "");

    const searchMatches =
      term === "" ||
      student?.name?.toLowerCase().includes(term) ||
      student?.studentId?.toLowerCase().includes(term);

    return gradeMatches && searchMatches;
  });

  const handleExport = () => {
    void exportArchiveRows({
      rows: filteredStudents,
      accountLabel: "Student",
      gradeLabel: selectedGrade,
      emptyMessage: `No ${selectedGrade.toLowerCase()} student archive records available to export.`,
    });
  };

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4">
        <p className="text-gray-600 text-md font-medium">Total: {filteredStudents.length}</p>
        <KebabMenu
          small
          align="right"
          renderItems={(close) => (
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  if (!filteredStudents.length) {
                    return;
                  }
                  handleExport();
                  close();
                }}
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${
                  filteredStudents.length === 0
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-[#013300] hover:bg-gray-50"
                }`}
                aria-disabled={filteredStudents.length === 0}
              >
                <ExportIcon />
                Export to Excel
              </button>
            </div>
          )}
        />
      </div>
      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "studentId", title: "Student ID" },
          { key: "name", title: "Full Name" },
          { key: "grade", title: "Grade" },
          { key: "section", title: "Section" },
          {
            key: "archivedDate",
            title: "Date Archived",
            render: (row: any) => row.archivedDateDisplay ?? "—",
          },
        ]}
        data={filteredStudents.map((student, index) => ({
          ...student,
          no: index + 1,
          grade: normalizeGrade(student?.grade ?? student?.grade),
        }))}
        actions={() => <></>}
        pageSize={10}
      />
    </div>
  );
}
