import TableList from "@/components/Common/Tables/TableList";
import KebabMenu from "@/components/Common/Menus/KebabMenu";
import { exportArchiveRows } from "../utils/export-columns";

const ExportIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14" />
  </svg>
);

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

  const handleExport = () => {
    void exportArchiveRows({
      rows: filteredAdmins,
      accountLabel: "IT Admin",
    });
  };

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4">
        <p className="text-gray-600 text-md font-medium">Total: {itAdmins.length}</p>
        <KebabMenu
          small
          align="right"
          buttonAriaLabel="Open IT Admin archive actions"
          renderItems={(close) => (
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  if (!filteredAdmins.length) {
                    return;
                  }
                  handleExport();
                  close();
                }}
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${
                  filteredAdmins.length === 0
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-[#013300] hover:bg-gray-50"
                }`}
                aria-disabled={filteredAdmins.length === 0}
              >
                <ExportIcon />
                Export to Excel
              </button>
            </div>
          )}
        />
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
