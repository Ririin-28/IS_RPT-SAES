import { useMemo, useState } from "react";
import TableList from "@/components/Common/Tables/TableList";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import SortMenu, { type SortMenuItem } from "@/components/Common/Menus/SortMenu";
import TeacherDetailModal from "./Modals/TeacherDetailModal";
import { formatTeacherFullName } from "./utils/formatTeacherName";

type StaffSortKey = "name_asc" | "name_desc";

interface AllTeachingStaffTabProps {
  teachers: any[];
  masterTeachers: any[];
  searchTerm: string;
  gradeFilter?: string;
}

const DEFAULT_SORT: StaffSortKey = "name_asc";

const SORT_ITEMS: SortMenuItem<StaffSortKey>[] = [
  { value: "name_asc", label: "Name (A-Z)" },
  { value: "name_desc", label: "Name (Z-A)" },
];

const extractGradeNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const match = value.match(/(\d+)/);
    if (match) {
      return Number(match[1]);
    }
  }
  return null;
};

const splitGradeLevels = (value: unknown): number[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => extractGradeNumber(item))
      .filter((item): item is number => Boolean(item));
  }
  const matches = String(value).match(/\d+/g) ?? [];
  return matches.map((item) => Number(item)).filter((item) => Number.isFinite(item));
};

const matchesGradeFilter = (teacher: any, gradeFilter: string | undefined): boolean => {
  if (!gradeFilter || gradeFilter === "All Grades") {
    return true;
  }

  const filterNumber = extractGradeNumber(gradeFilter);
  if (!filterNumber) {
    return true;
  }

  const gradeLevels = Array.isArray(teacher?.gradeLevels)
    ? teacher.gradeLevels.map((value: unknown) => extractGradeNumber(value)).filter((value: number | null): value is number => Boolean(value))
    : splitGradeLevels(teacher?.gradeLevels ?? teacher?.grades ?? teacher?.handledGrades);

  if (gradeLevels.length) {
    return gradeLevels.includes(filterNumber);
  }

  const teacherGrade =
    extractGradeNumber(teacher?.gradeNumber) ??
    extractGradeNumber(teacher?.grade) ??
    extractGradeNumber(teacher?.handledGrade) ??
    extractGradeNumber(teacher?.handled_grade);

  return teacherGrade === filterNumber;
};

export default function AllTeachingStaffTab({
  teachers,
  masterTeachers,
  searchTerm,
  gradeFilter = "All Grades",
}: AllTeachingStaffTabProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [sortBy, setSortBy] = useState<StaffSortKey>(DEFAULT_SORT);

  const mergedStaff = useMemo(
    () => [
      ...masterTeachers.map((teacher) => ({ ...teacher, __staffType: "Master Teacher" })),
      ...teachers.map((teacher) => ({ ...teacher, __staffType: "Teacher" })),
    ],
    [masterTeachers, teachers],
  );

  const filteredTeachers = useMemo(
    () =>
      mergedStaff.filter((teacher: any) => {
        if (!matchesGradeFilter(teacher, gradeFilter)) {
          return false;
        }

        const displayName = formatTeacherFullName(teacher).toLowerCase();
        const query = searchTerm.toLowerCase();

        return (
          searchTerm === "" ||
          displayName.includes(query) ||
          teacher.email?.toLowerCase().includes(query) ||
          teacher.teacherId?.toLowerCase().includes(query)
        );
      }),
    [mergedStaff, gradeFilter, searchTerm],
  );

  const sortedTeachers = useMemo(() => {
    const compareName = (a: any, b: any) =>
      formatTeacherFullName(a).localeCompare(formatTeacherFullName(b), undefined, { sensitivity: "base" });

    const list = [...filteredTeachers];
    list.sort((a, b) => (sortBy === "name_asc" ? compareName(a, b) : compareName(b, a)));
    return list;
  }, [filteredTeachers, sortBy]);

  const handleShowDetails = (teacher: any) => {
    setSelectedTeacher(teacher);
    setShowDetailModal(true);
  };

  return (
    <div>
      <div className="mb-4 flex flex-row items-center justify-between">
        <p className="text-gray-600 text-md font-medium">Total: {sortedTeachers.length}</p>
        <SortMenu
          small
          iconOnly
          align="right"
          value={sortBy}
          items={SORT_ITEMS}
          onChange={setSortBy}
          buttonAriaLabel="Open teaching staff sort options"
        />
      </div>

      <TeacherDetailModal show={showDetailModal} onClose={() => setShowDetailModal(false)} teacher={selectedTeacher} />

      <TableList
        showFullScreenToggle
        columns={[
          { key: "no", title: "No#" },
          { key: "name", title: "Full Name" },
          { key: "staffType", title: "Role" },
          { key: "email", title: "Email" },
          { key: "gradeLevel", title: "Grade Level" },
          { key: "handledSubject", title: "Handled Subject" },
        ]}
        data={sortedTeachers.map((teacher: any, idx: number) => ({
          ...teacher,
          name: formatTeacherFullName(teacher),
          staffType: teacher.__staffType,
          gradeLevel: teacher.grade ?? teacher.gradeLevel ?? teacher.gradeNumber ?? "-",
          handledSubject:
            teacher.__staffType === "Teacher"
              ? "All Subjects"
              : teacher.subjects ?? teacher.subject ?? teacher.handledSubject ?? "-",
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
