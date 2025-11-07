import BaseModal, { ModalSection, ModalInfoItem } from "@/components/Common/Modals/BaseModal";

interface PrincipalDetailsModalProps {
  show: boolean;
  onClose: () => void;
  principal: any;
}

export default function PrincipalDetailsModal({ show, onClose, principal }: PrincipalDetailsModalProps) {
  if (!show || !principal) return null;

  const footer = (
    <button
      onClick={onClose}
      className="bg-[#013300] text-white px-6 py-2 rounded-lg hover:bg-[#013300]/90 transition-colors font-medium"
    >
      Close
    </button>
  );

  return (
    <BaseModal
      show={show}
      onClose={onClose}
      title="Principal Details"
      maxWidth="2xl"
      footer={footer}
    >
      <ModalSection title="Personal Details">
        <div className="space-y-4">
          {/* 1st Row: Principal ID and Role */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ModalInfoItem label="Principal ID" value={principal.userId || principal.user_id || principal.principalId || "—"} />
            <ModalInfoItem label="Role" value={principal.roleLabel || principal.role || "Principal"} />
          </div>
          
          {/* 2nd Row: Full Name with helper text */}
          <div className="space-y-1">
            <ModalInfoItem 
              label="Full Name" 
              value={principal.name || principal.fullName || "—"} 
            />
            <p className="text-xs text-gray-500 pl-1">Format: First, Middle, Last, Suffix</p>
          </div>
        </div>
      </ModalSection>

      <ModalSection title="Contact Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Email" value={principal.email || principal.user_email || principal.contactEmail || "—"} />
          <ModalInfoItem
            label="Phone Number"
            value={principal.contactNumber || principal.contact_number || principal.contactNo || principal.phoneNumber || principal.phone || principal.mobile || "—"}
          />
        </div>
      </ModalSection>

      <ModalSection title="Archive Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Archived Date" value={principal.archivedDateDisplay || "—"} />
          <ModalInfoItem label="Reason" value={principal.reason || "—"} />
        </div>
      </ModalSection>
    </BaseModal>
  );
}
