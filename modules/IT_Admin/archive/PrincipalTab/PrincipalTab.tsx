import { useState } from "react";
import TableList from "@/components/Common/Tables/TableList";

interface PrincipalTabProps {
  principals: any[];
  setPrincipals: (principals: any[]) => void;
  searchTerm: string;
}

export default function PrincipalTab({ principals, setPrincipals, searchTerm }: PrincipalTabProps) {
  const filteredPrincipals = principals.filter((principal) => {
    const matchSearch = searchTerm === "" || 
      principal.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      principal.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      principal.principalId?.toLowerCase().includes(searchTerm.toLowerCase());
      
    return matchSearch;
  });

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {principals.length}
        </p>
      </div>

      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "principalId", title: "Principal ID" },
          { key: "name", title: "Full Name" },
          { key: "email", title: "Email" },
          { key: "contactNumber", title: "Contact Number" },
          {
            key: "archivedDate",
            title: "Archived Date",
            render: (row: any) => row.archivedDateDisplay ?? "—",
          },
        ]}
        data={filteredPrincipals.map((principal, idx) => ({
          ...principal,
          no: idx + 1,
        }))}
        actions={() => <></>}
        pageSize={10}
      />
    </div>
  );
}