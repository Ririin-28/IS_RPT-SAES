import { useState, useRef, useEffect, useCallback } from "react";
import TableList from "@/components/Common/Tables/TableList";
import UserDetailModal from "../Modals/UserDetailsModal";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import AccountActionsMenu, { type AccountActionKey } from "../components/AccountActionsMenu";

interface PrincipalTabProps {
  principals: any[];
  setPrincipals: (principals: any[]) => void;
  searchTerm: string;
}

interface KebabMenuProps {
  onEdit: () => void;
  onDelete: () => void;
}

const KebabMenu = ({ onEdit, onDelete }: KebabMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 hover:bg-gray-100 rounded"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10">
          <button
            onClick={() => {
              onEdit();
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-sm text-[#013300] hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button
            onClick={() => {
              onDelete();
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default function PrincipalTab({ principals, setPrincipals, searchTerm }: PrincipalTabProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPrincipal, setSelectedPrincipal] = useState<any>(null);

  const handleMenuAction = useCallback((action: AccountActionKey) => {
    console.log(`[Principal Tab] Action triggered: ${action}`);
  }, []);

  const filteredPrincipals = principals.filter((principal) => {
    const matchSearch = searchTerm === "" || 
      principal.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      principal.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      principal.principalId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      principal.school?.toLowerCase().includes(searchTerm.toLowerCase());
      
    return matchSearch;
  });

  const handleShowDetails = (principal: any) => {
    setSelectedPrincipal(principal);
    setShowDetailModal(true);
  };

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4 gap-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {principals.length}
        </p>
        <AccountActionsMenu
          accountType="Principal"
          onAction={handleMenuAction}
          buttonAriaLabel="Open principal actions"
        />
      </div>
      
      <UserDetailModal
        show={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        user={selectedPrincipal}
      />

      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "principalId", title: "Principal ID" },
          { key: "name", title: "Full Name" },
          { key: "email", title: "Email" },
          { key: "school", title: "School" },
          { key: "contactNumber", title: "Contact Number" },
          { key: "status", title: "Status" },
        ]}
        data={filteredPrincipals.map((principal, idx) => ({
          ...principal,
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <div className="flex items-center gap-2">
            <UtilityButton small onClick={() => handleShowDetails(row)}>
              View Details
            </UtilityButton>
            <KebabMenu
              onEdit={() => console.log('Edit', row)}
              onDelete={() => console.log('Delete', row)}
            />
          </div>
        )}
        pageSize={10}
      />
    </div>
  );
}