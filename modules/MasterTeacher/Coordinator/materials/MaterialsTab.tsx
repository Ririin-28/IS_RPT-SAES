"use client";

import { useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";
import RequestsModal from "@/modules/MasterTeacher/Coordinator/materials/Modals/RequestsModal";
import { useMaterialsList } from "@/modules/MasterTeacher/useArchiveMaterials";

type MaterialItem = {
  id: number;
  title: string;
  dateAttached: string;
  domain?: string;
  [key: string]: unknown;
};

type TableColumn = {
  key: string;
  title: string;
};

type MaterialTabContentProps = {
  subject: string;
  category: string;
  columns?: TableColumn[];
  showRequestsModal?: boolean;
};

export default function MaterialTabContent({
  subject,
  category,
  columns,
  showRequestsModal = false,
}: MaterialTabContentProps) {
  const { materials, setMaterials } = useMaterialsList<MaterialItem>({
    subject,
    category,
  });
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);

  const handleDelete = (id: number) => {
    setMaterials((prev) => prev.filter((material) => material.id !== id));
  };

  const handleDeleteAll = () => {
    setMaterials([]);
  };

  const tableColumns: TableColumn[] = columns ?? [
    { key: "no", title: "No#" },
    { key: "title", title: "Title" },
    { key: "dateAttached", title: "Date Attached" },
  ];

  const tableData = materials.map((material, index) => ({
    ...material,
    no: index + 1,
  }));

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
          <UtilityButton
            small
            onClick={showRequestsModal ? () => setIsRequestsModalOpen(true) : undefined}
          >
            <span className="flex items-center gap-1">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
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
        columns={tableColumns}
        data={tableData}
  actions={(row: MaterialItem & { no: number }) => (
          <>
            <UtilityButton small>See All</UtilityButton>
            <DangerButton small onClick={() => handleDelete(row.id)}>
              Delete
            </DangerButton>
          </>
        )}
        pageSize={10}
      />
      {showRequestsModal && (
        <RequestsModal
          show={isRequestsModalOpen}
          onClose={() => setIsRequestsModalOpen(false)}
          category={category}
        />
      )}
    </div>
  );
}
