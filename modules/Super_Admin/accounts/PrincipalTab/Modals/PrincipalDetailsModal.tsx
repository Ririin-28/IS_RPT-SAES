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
            <ModalInfoItem label="Principal ID" value={principal.itAdminId || principal.principalId} />
            <ModalInfoItem label="Role" value={principal.role || "Principal"} />
          </div>
          
          {/* 2nd Row: Name fields */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ModalInfoItem label="First Name" value={principal.firstName ?? principal.first_name ?? ""} />
            <ModalInfoItem label="Middle Name" value={principal.middleName ?? principal.middle_name ?? ""} />
            <ModalInfoItem label="Last Name" value={principal.lastName ?? principal.last_name ?? ""} />
            <ModalInfoItem label="Suffix" value={principal.suffix ?? principal.suffix_name ?? principal.suf ?? ""} />
          </div>
        </div>
      </ModalSection>

      <ModalSection title="Contact Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Email" value={principal.email} />
          <ModalInfoItem label="Phone Number" value={principal.phoneNumber || principal.contactNumber} />
        </div>
      </ModalSection>
    </BaseModal>
  );
}
