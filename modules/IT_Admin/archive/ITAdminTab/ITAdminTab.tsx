import TableList from "@/components/Common/Tables/TableList";

interface ITAdminArchiveTabProps {
  itAdmins: any[];
  searchTerm: string;
}

export default function ITAdminArchiveTab({ itAdmins, searchTerm }: ITAdminArchiveTabProps) {
  const filteredAdmins = itAdmins.filter((admin) => {
    const term = searchTerm.trim().toLowerCase();
    if (term === "") return true;
    return (
      admin?.name?.toLowerCase().includes(term) ||
      admin?.email?.toLowerCase().includes(term) ||
      admin?.adminId?.toLowerCase().includes(term)
    );
  });

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4">
        <p className="text-gray-600 text-md font-medium">Total: {itAdmins.length}</p>
      </div>
      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "adminId", title: "Admin ID" },
          { key: "name", title: "Full Name" },
          { key: "email", title: "Email" },
          {
            key: "archivedDate",
            title: "Archived Date",
            render: (row: any) => row.archivedDateDisplay ?? "—",
          },
        ]}
        data={filteredAdmins.map((admin, index) => ({
          ...admin,
          no: index + 1,
        }))}
        actions={() => <></>}
        pageSize={10}
      />
    </div>
  );
}
