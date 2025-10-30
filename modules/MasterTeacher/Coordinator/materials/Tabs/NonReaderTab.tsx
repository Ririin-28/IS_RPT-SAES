"use client";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import TableList from "@/components/Common/Tables/TableList";
import { useMaterialsList } from "@/modules/MasterTeacher/useArchiveMaterials";
import RequestsModal from "@/components/MasterTeacher/Coordinator/RequestsModal";
import { useState } from "react";

type MaterialItem = {
  id: number;
  title: string;
  dateAttached: string;
};

export default function NonReaderTab() {
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const { materials, setMaterials } = useMaterialsList<MaterialItem>({
    subject: "English",
    category: "Non Reader",
  });

  const handleDelete = (id: number) => {
    setMaterials((prev) => prev.filter((material) => material.id !== id));
  };

  const handleDeleteAll = () => {
    setMaterials([]);
  };

  return (
    <div>
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
        Total: {materials.length}
        </p>
        <div className="flex gap-2">
          <UtilityButton small onClick={() => setShowRequestsModal(true)}>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="hidden sm:inline">Requests</span>
            </span>
          </UtilityButton>
          {materials.length > 0 && (
            <DangerButton small onClick={handleDeleteAll}>
              Delete All
            </DangerButton>
          )}
        </div>
      </div>
      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "title", title: "Title" },
          { key: "dateAttached", title: "Date Attached" },
        ]}
        data={materials.map((material, idx) => ({
          ...material,
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
      <RequestsModal
        show={showRequestsModal}
        onClose={() => setShowRequestsModal(false)}
        category="Non Reader"
      />
    </div>
  );
}


