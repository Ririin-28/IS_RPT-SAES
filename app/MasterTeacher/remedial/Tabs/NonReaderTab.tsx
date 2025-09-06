"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
// Button Components
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
// Text Components
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
import BodyLabel from "@/components/Common/Texts/BodyLabel";
import TableList from "@/components/Common/Tables/TableList";

export default function NonReaderTab() {
  // Hardcoded lesson data for remedial flashcards
  const [students, setStudents] = useState<any[]>([
    {
      id: 1,
      title: "Lesson 1- Consonant",
      phonemic: "Non-Reader",
      dateToUse: "2024-06-01",
      status: "Approved",
    },
    {
      id: 2,
      title: "Lesson 2- Vowel",
      phonemic: "Non-Reader",
      dateToUse: "2024-06-02",
      status: "Pending",
    },
  ]);

  // Delete individual student
  const handleDelete = (id: number) => {
    setStudents(students.filter((s) => s.id !== id));
  };

  // Delete all students
  const handleDeleteAll = () => {
    setStudents([]);
  };

  return (
    <div>
      {/* Student Table Section */}
      <SecondaryHeader title="Non Reader Modules" />
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
        <TertiaryHeader title={`Total: ${students.length}`} />
        <div className="flex gap-2"></div>
      </div>
      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "title", title: "Title" },
          { key: "phonemic", title: "Phonemic" },
          { key: "dateToUse", title: "Date to use" },
          { key: "status", title: "Status" },
        ]}
        data={students.map((student, idx) => ({
          ...student,
          no: idx + 1,
        }))}
        actions={(row: any) => (
        <>
          <a href={`/MasterTeacher/remedial/Flashcards`}>
            <UtilityButton small>See All</UtilityButton>
          </a>
          <DangerButton small onClick={() => handleDelete(row.id)}>
            Delete
          </DangerButton>
        </>
        )}
        pageSize={10}
      />
    </div>
  );
}


