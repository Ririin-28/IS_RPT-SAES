import { useMemo, useState } from "react";
import TableList from "@/components/Common/Tables/TableList";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import ParentDetailsModal from "./Modals/ParentDetailsModal";

interface ParentTabProps {
  parents: any[];
  searchTerm: string;
}

function toSearchableString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim().toLowerCase();
}

function formatContactNumber(parent: any): string {
  return parent.contactNumberLocal ?? parent.contactNumber ?? "--";
}

export default function ParentTab({ parents, searchTerm }: ParentTabProps) {
  const [selectedParent, setSelectedParent] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const filteredParents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return parents;
    }

    return parents.filter((parent) => {
      const linkedStudents = Array.isArray(parent.linkedStudents) ? parent.linkedStudents : [];
      const linkedStudentText = linkedStudents
        .flatMap((student: any) => [
          student.name,
          student.studentId,
          student.grade,
          student.section,
          student.relationship,
          student.remedialStatus,
        ])
        .map(toSearchableString)
        .join(" ");

      const haystack = [
        parent.parentId,
        parent.name,
        parent.email,
        parent.contactNumber,
        parent.contactNumberLocal,
        parent.lastLoginDisplay,
        linkedStudentText,
      ]
        .map(toSearchableString)
        .join(" ");

      return haystack.includes(query);
    });
  }, [parents, searchTerm]);

  const handleShowDetails = (parent: any) => {
    setSelectedParent(parent);
    setShowDetailsModal(true);
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-md font-medium text-gray-600">
          Total: {filteredParents.length}
        </p>
      </div>

      <ParentDetailsModal
        show={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        parent={selectedParent}
      />

      <TableList
        showFullScreenToggle
        columns={[
          { key: "no", title: "No#" },
          { key: "parentId", title: "Parent ID", render: (row: any) => row.parentId ?? "--" },
          { key: "name", title: "Full Name", render: (row: any) => row.name ?? "--" },
          { key: "email", title: "Email", render: (row: any) => row.email ?? "--" },
          {
            key: "contactNumber",
            title: "Contact Number",
            render: (row: any) => formatContactNumber(row),
          },
          {
            key: "linkedStudentsCount",
            title: "Students",
            render: (row: any) => row.linkedStudentsCount ?? row.linkedStudents?.length ?? 0,
          },
          {
            key: "lastLoginDisplay",
            title: "Last Login",
            render: (row: any) => row.lastLoginDisplay ?? "--",
          },
        ]}
        data={filteredParents.map((parent, idx) => ({
          ...parent,
          id: String(parent.userId ?? parent.parentId ?? parent.email ?? idx),
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <UtilityButton small onClick={() => handleShowDetails(row)} title="Click to view students">
            View
          </UtilityButton>
        )}
        pageSize={10}
      />
    </div>
  );
}
