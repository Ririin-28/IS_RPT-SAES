import { useState } from "react";
import TeacherDetailModal from "../Modals/TeacherDetailModal";
import type { CoordinatorTeacher } from "../useCoordinatorTeachers";
// Button Components

import UtilityButton from "@/components/Common/Buttons/UtilityButton";


import TableList from "@/components/Common/Tables/TableList";

interface TeacherTabProps {
  teachers: CoordinatorTeacher[];
  searchTerm: string;
}

export default function TeacherTab({ teachers, searchTerm }: TeacherTabProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);



  // Filter teachers based on search term
  const filteredTeachers = teachers.filter((teacher) => {
    const matchSearch = searchTerm === "" || 
      teacher.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.teacherId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.contactNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      
    return matchSearch;
  });



  // Show teacher details
  const handleShowDetails = (teacher: any) => {
    setSelectedTeacher(teacher);
    setShowDetailModal(true);
  };



  return (
    <div>
      {/* Top Bar: Total */}
      <div className="flex flex-row justify-between items-center mb-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {filteredTeachers.length}
        </p>
      </div>
      
      {/* Teacher Detail Modal */}
      <TeacherDetailModal
        show={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        teacher={selectedTeacher}
      />

      {/* Table */}
      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "teacherId", title: "Teacher ID" },
          { key: "name", title: "Full Name" },
          { key: "email", title: "Email" },
          { key: "contactNumber", title: "Contact Number" },
        ]}
        data={filteredTeachers.map((teacher, idx) => ({
          ...teacher,
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <UtilityButton small onClick={() => handleShowDetails(row)} title="View teacher details">
            View
          </UtilityButton>
        )}
        pageSize={10}
      />

    </div>
  );
}