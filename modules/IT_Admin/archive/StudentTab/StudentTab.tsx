import TableList from "@/components/Common/Tables/TableList";

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

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4">
        <p className="text-gray-600 text-md font-medium">Total: {filteredStudents.length}</p>
      </div>
      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "studentId", title: "Student ID" },
          { key: "name", title: "Full Name" },
          { key: "grade", title: "Grade" },
          { key: "section", title: "Section" },
          { key: "archivedDate", title: "Date Archived" },
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
