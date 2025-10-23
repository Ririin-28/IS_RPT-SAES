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

export default function EnglishSyllableTab() {
  // Example data, replace with real data as needed
  const [remedials, setRemedials] = useState<any[]>([]);

  // Delete individual remedial
  const handleDelete = (id: number) => {
    setRemedials(remedials.filter((s) => s.id !== id));
  };

  // Delete all remedials
  const handleDeleteAll = () => {
    setRemedials([]);
  };

  return (
    <div>
      {/* Remedial Table Section */}
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
        <p className="text-gray-600 text-md font-medium">
        Total: {remedials.length}
        </p>
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
        data={remedials.map((remedials, idx) => ({
          ...remedials,
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <>
            <UtilityButton small>See All</UtilityButton>
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


