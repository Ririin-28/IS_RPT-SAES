import { useMemo, useState } from "react";
import TableList from "@/components/Common/Tables/TableList";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import ExportUtilityButton from "@/components/Common/Buttons/ExportUtilityButton";
import ITAdminDetailsModal from "../ITAdminTab/ITAdminDetailsModal";
import PrincipalDetailsModal from "../PrincipalTab/PrincipalDetailsModal";
import MasterTeacherDetailsModal from "@/modules/IT_Admin/accounts/MasterTeacherTab/Modals/MasterTeacherDetailsModal";
import TeacherDetailsModal from "@/modules/IT_Admin/accounts/TeacherTab/Modals/TeacherDetailsModal";
import { exportArchiveRows } from "../utils/export-columns";

interface ArchiveAllAccountsTabProps {
  accounts: any[];
  searchTerm: string;
}

function toSearchableString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim().toLowerCase();
}

function resolveRoleLabel(account: any): string {
  const roleKey = String(account?.roleKey ?? "").toLowerCase();
  if (roleKey === "it_admin") return "IT Admin";
  if (roleKey === "principal") return "Principal";
  if (roleKey === "master_teacher") return "Master Teacher";
  if (roleKey === "teacher") return "Teacher";
  return account?.roleLabel ?? "Unknown";
}

function resolveIdentifier(account: any): string {
  return (
    account?.adminId ??
    account?.principalId ??
    account?.masterTeacherId ??
    account?.teacherId ??
    account?.userId ??
    account?.user_id ??
    "--"
  );
}

export default function AllAccountsTab({ accounts, searchTerm }: ArchiveAllAccountsTabProps) {
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const filteredAccounts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return accounts;
    }

    return accounts.filter((account) => {
      const haystack = [
        resolveRoleLabel(account),
        resolveIdentifier(account),
        account?.name,
        account?.email,
      ]
        .map(toSearchableString)
        .join(" ");

      return haystack.includes(query);
    });
  }, [accounts, searchTerm]);

  const handleShowDetails = (account: any) => {
    setSelectedAccount(account);
    setShowDetailsModal(true);
  };

  const handleCloseDetails = () => {
    setShowDetailsModal(false);
    setSelectedAccount(null);
  };

  const selectedRoleKey = String(selectedAccount?.roleKey ?? "").toLowerCase();

  const handleExport = () => {
    void exportArchiveRows({
      rows: filteredAccounts,
      accountLabel: "All Users",
      emptyMessage: "No archived user records available to export.",
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-gray-600 text-md font-medium">Total: {filteredAccounts.length}</p>
        <ExportUtilityButton onExport={handleExport} disabled={filteredAccounts.length === 0} />
      </div>

      <ITAdminDetailsModal
        show={showDetailsModal && selectedRoleKey === "it_admin"}
        onClose={handleCloseDetails}
        itAdmin={selectedAccount}
      />
      <PrincipalDetailsModal
        show={showDetailsModal && selectedRoleKey === "principal"}
        onClose={handleCloseDetails}
        principal={selectedAccount}
      />
      <MasterTeacherDetailsModal
        show={showDetailsModal && selectedRoleKey === "master_teacher"}
        onClose={handleCloseDetails}
        masterTeacher={selectedAccount}
      />
      <TeacherDetailsModal
        show={showDetailsModal && selectedRoleKey === "teacher"}
        onClose={handleCloseDetails}
        teacher={selectedAccount}
      />

      <TableList
        showFullScreenToggle
        columns={[
          { key: "no", title: "No#" },
          { key: "role", title: "Role", render: (row: any) => resolveRoleLabel(row) },
          { key: "accountId", title: "Account ID", render: (row: any) => resolveIdentifier(row) },
          { key: "name", title: "Full Name", render: (row: any) => row?.name ?? "--" },
          { key: "email", title: "Email", render: (row: any) => row?.email ?? "--" },
          { key: "archivedDateDisplay", title: "Archived Date", render: (row: any) => row?.archivedDateDisplay ?? "--" },
        ]}
        data={filteredAccounts.map((account, idx) => ({
          ...account,
          id: String(account?.archiveId ?? account?.userId ?? account?.email ?? idx),
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <UtilityButton small onClick={() => handleShowDetails(row)} title="Click to view details">
            View
          </UtilityButton>
        )}
        pageSize={10}
      />
    </div>
  );
}
