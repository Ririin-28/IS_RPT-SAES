import { useState, useRef, useEffect } from "react";
import TableList from "@/components/Common/Tables/TableList";
import UserDetailModal from "../Modals/UserDetailsModal";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";



interface ITAdminTabProps {
  itAdmins: any[];
  setITAdmins: (itAdmins: any[]) => void;
  searchTerm: string;
}



export default function ITAdminTab({ itAdmins, setITAdmins, searchTerm }: ITAdminTabProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedITAdmin, setSelectedITAdmin] = useState<any>(null);


  const filteredITAdmins = itAdmins.filter((admin) => {
    const matchSearch = searchTerm === "" || 
      admin.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.adminId?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch;
  });

  const handleShowDetails = (admin: any) => {
    setSelectedITAdmin(admin);
    setShowDetailModal(true);
  };



  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {itAdmins.length}
        </p>
        

      </div>
      
      <UserDetailModal
        show={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        user={selectedITAdmin}
      />

      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "adminId", title: "Admin ID" },
          { key: "name", title: "Full Name" },
          { key: "email", title: "Email" },
          { key: "lastLogin", title: "Last Login" },
        ]}
        data={filteredITAdmins.map((admin, idx) => ({
          ...admin,
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <UtilityButton small onClick={() => handleShowDetails(row)}>
            View Details
          </UtilityButton>
        )}
        pageSize={10}
      />
    </div>
  );
}