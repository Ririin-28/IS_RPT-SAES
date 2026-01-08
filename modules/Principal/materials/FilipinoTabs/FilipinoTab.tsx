"use client";
import { useMemo, useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";

interface FilipinoTabProps {
  level: string;
  grade: string;
  searchTerm?: string;
}

// Shared Filipino tab for Principal materials; filters by grade and search term.
export default function FilipinoTab({ level, grade, searchTerm = "" }: FilipinoTabProps) {
  const [materials, setMaterials] = useState<any[]>([]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredMaterials = useMemo(() => {
    return materials.filter((material) => {
      const matchesGrade = !grade || material.gradeSection === grade || material.grade === grade;
      if (!matchesGrade) return false;

      if (!normalizedSearch) return true;
      const title = material.title?.toLowerCase() ?? "";
      const teacher = material.teacher?.toLowerCase() ?? "";
      const levelLabel = material.level?.toLowerCase() ?? "";
      return (
        title.includes(normalizedSearch) ||
        teacher.includes(normalizedSearch) ||
        levelLabel.includes(normalizedSearch)
      );
    });
  }, [materials, grade, normalizedSearch]);

  const handleDelete = (id: number) => {
    setMaterials((prev) => prev.filter((material) => material.id !== id));
  };

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4 sm:mb-6 md:mb-2">
        <p className="text-gray-600 text-md font-medium">Total: {filteredMaterials.length}</p>
      </div>
      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "title", title: "Title" },
          { key: "level", title: "Level" },
          { key: "gradeSection", title: "Grade" },
          { key: "teacher", title: "Teacher" },
          { key: "dateAttached", title: "Date Attached" },
        ]}
        data={filteredMaterials.map((material, idx) => ({
          ...material,
          level,
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <>
            <UtilityButton small>View Details</UtilityButton>
            <DangerButton small onClick={() => handleDelete(row.id)}>Delete</DangerButton>
          </>
        )}
        pageSize={10}
      />
    </div>
  );
}
