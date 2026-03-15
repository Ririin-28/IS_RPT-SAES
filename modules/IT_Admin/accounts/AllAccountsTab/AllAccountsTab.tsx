import { useMemo, useState } from "react";
import TableList from "@/components/Common/Tables/TableList";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import ITAdminDetailsModal from "../ITAdminTab/Modals/ITAdminDetailsModal";
import PrincipalDetailsModal from "../PrincipalTab/Modals/PrincipalDetailsModal";
import MasterTeacherDetailsModal from "../MasterTeacherTab/Modals/MasterTeacherDetailsModal";
import TeacherDetailsModal from "../TeacherTab/Modals/TeacherDetailsModal";
import ParentDetailsModal from "../ParentTab/Modals/ParentDetailsModal";

interface AllAccountsTabProps {
  accounts: any[];
  searchTerm: string;
}

function toSearchableString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim().toLowerCase();
}

export default function AllAccountsTab({ accounts, searchTerm }: AllAccountsTabProps) {
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const filteredAccounts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return accounts;
    }

    return accounts.filter((account) => {
      const haystack = [
        account.name,
        account.email,
        account.roleLabel,
        account.identifierValue,
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

  const selectedRole = selectedAccount?.roleLabel ?? selectedAccount?.role ?? null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {filteredAccounts.length}
        </p>
      </div>

      <ITAdminDetailsModal
        show={showDetailsModal && selectedRole === "IT Admin"}
        onClose={handleCloseDetails}
        itAdmin={selectedAccount}
      />
      <PrincipalDetailsModal
        show={showDetailsModal && selectedRole === "Principal"}
        onClose={handleCloseDetails}
        principal={selectedAccount}
      />
      <MasterTeacherDetailsModal
        show={showDetailsModal && selectedRole === "Master Teacher"}
        onClose={handleCloseDetails}
        masterTeacher={selectedAccount}
      />
      <TeacherDetailsModal
        show={showDetailsModal && selectedRole === "Teacher"}
        onClose={handleCloseDetails}
        teacher={selectedAccount}
      />
      <ParentDetailsModal
        show={showDetailsModal && selectedRole === "Parent"}
        onClose={handleCloseDetails}
        parent={selectedAccount}
      />

      <TableList
        showFullScreenToggle
        columns={[
          { key: "no", title: "No#" },
          { key: "roleLabel", title: "Role", render: (row: any) => row.roleLabel ?? "--" },
          { key: "identifierValue", title: "Account ID", render: (row: any) => row.identifierValue ?? "--" },
          { key: "name", title: "Full Name", render: (row: any) => row.name ?? "--" },
          { key: "email", title: "Email", render: (row: any) => row.email ?? "--" },
          {
            key: "lastLoginDisplay",
            title: "Last Login",
            render: (row: any) => row.lastLoginDisplay ?? "--",
          },
        ]}
        data={filteredAccounts.map((account, idx) => ({
          ...account,
          id: String(account.userId ?? account.identifierValue ?? account.email ?? idx),
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
