import React, { useState } from "react";
import BaseModal from "@/components/Common/Modals/BaseModal";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";

interface MaterialRequest {
  id: number;
  title: string;
  submittedBy: string;
  dateSubmitted: string;
  status: "pending";
}

interface RequestsModalProps {
  show: boolean;
  onClose: () => void;
  category: string;
}

export default function RequestsModal({ show, onClose, category }: RequestsModalProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const [requests, setRequests] = useState<MaterialRequest[]>([
    {
      id: 1,
      title: "Sample Material 1",
      submittedBy: "Teacher A",
      dateSubmitted: "2024-01-15",
      status: "pending",
    },
    {
      id: 2,
      title: "Sample Material 2",
      submittedBy: "Teacher B",
      dateSubmitted: "2024-01-16",
      status: "pending",
    },
  ]);

  const handleAccept = (id: number) => {
    setRequests((prev) => prev.filter((req) => req.id !== id));
  };

  const handleReject = (id: number) => {
    setRequests((prev) => prev.filter((req) => req.id !== id));
  };

  return (
    <BaseModal show={show} onClose={onClose} title={`Material Requests - ${category}`} maxWidth="4xl">
      <div className="space-y-4">
        <p className="text-gray-600 text-sm">
          Total Requests: {requests.length}
        </p>
        <TableList
          columns={[
            { key: "no", title: "No#" },
            { key: "title", title: "Title" },
            { key: "submittedBy", title: "Submitted By" },
            { key: "dateSubmitted", title: "Date Submitted" },
          ]}
          data={requests.map((req, idx) => ({
            ...req,
            no: idx + 1,
            dateSubmitted: formatDate(req.dateSubmitted),
          }))}
          actions={(row: any) => (
            <>
              <UtilityButton small onClick={() => handleAccept(row.id)}>
                Accept
              </UtilityButton>
              <DangerButton small onClick={() => handleReject(row.id)}>
                Reject
              </DangerButton>
            </>
          )}
          pageSize={5}
        />
      </div>
    </BaseModal>
  );
}
