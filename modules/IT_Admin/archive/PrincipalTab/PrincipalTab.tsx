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

  const handleExport = () => {
    void exportArchiveRows({
      rows: filteredPrincipals,
      accountLabel: "Principal",
    });
  };

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {principals.length}
        </p>
        <KebabMenu
          small
          align="right"
          buttonAriaLabel="Open principal archive actions"
          renderItems={(close) => (
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  if (!filteredPrincipals.length) {
                    return;
                  }
                  handleExport();
                  close();
                }}
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${
                  filteredPrincipals.length === 0
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-[#013300] hover:bg-gray-50"
                }`}
                aria-disabled={filteredPrincipals.length === 0}
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