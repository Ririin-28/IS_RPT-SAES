"use client";
import { useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";

export default function FilipinoNonReaderTab() {
  const [remedials, setRemedials] = useState<any[]>([
    {
      id: 1,
      title: "Aralin 1 - Katinig",
      phonemic: "Non-Reader",
      dateToUse: "2024-06-01",
      status: "Approved",
    },
    {
      id: 2,
      title: "Aralin 2 - Patinig",
      phonemic: "Non-Reader",
      dateToUse: "2024-06-02",
      status: "Pending",
    },
    {
      id: 3,
      title: "Aralin 3 - Pantig",
      phonemic: "Non-Reader",
      dateToUse: "2024-06-03",
      status: "Approved",
    },
  ]);

  const handleDelete = (id: number) => {
    setRemedials(remedials.filter((r) => r.id !== id));
  };

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4 sm:mb-6 md:mb-2">
        <p className="text-gray-600 text-md font-medium">
          Kabuuan: {remedials.length}
        </p>
      </div>
      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "title", title: "Pamagat" },
          { key: "phonemic", title: "Phonemic" },
          { key: "dateToUse", title: "Petsa ng Paggamit" },
          { key: "status", title: "Katayuan" },
        ]}
        data={remedials.map((r, idx) => ({ ...r, no: idx + 1 }))}
        actions={(row: any) => (
          <>
            <a href="/MasterTeacher/remedial/FilipinoFlashcards">
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
