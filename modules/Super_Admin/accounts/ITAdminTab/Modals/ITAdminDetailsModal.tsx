import BaseModal, { ModalSection, ModalInfoItem } from "@/components/Common/Modals/BaseModal";

interface ITAdminDetailsModalProps {
  show: boolean;
  onClose: () => void;
  itAdmin: any;
}

export default function ITAdminDetailsModal({ show, onClose, itAdmin }: ITAdminDetailsModalProps) {
  if (!show || !itAdmin) return null;

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
      title="Super Admin Details"
      maxWidth="2xl"
      footer={footer}
    >
      <ModalSection title="Personal Details">
        <div className="space-y-4">
          {/* 1st Row: Super Admin ID and Role */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ModalInfoItem label="Super Admin ID" value={itAdmin.itAdminId || itAdmin.adminId} />
            <ModalInfoItem label="Role" value={itAdmin.role || "Super Admin"} />
          </div>
          
          {/* 2nd Row: Name fields */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ModalInfoItem label="First Name" value={itAdmin.firstName ?? itAdmin.first_name ?? ""} />
            <ModalInfoItem label="Middle Name" value={itAdmin.middleName ?? itAdmin.middle_name ?? ""} />
            <ModalInfoItem label="Last Name" value={itAdmin.lastName ?? itAdmin.last_name ?? ""} />
            <ModalInfoItem label="Suffix" value={itAdmin.suffix ?? itAdmin.suffix_name ?? itAdmin.suf ?? ""} />
          </div>
        </div>
      </ModalSection>

      <ModalSection title="Contact Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Email" value={itAdmin.email} />
          <ModalInfoItem
            label="Phone Number"
            value={itAdmin.contactNumberDisplay || itAdmin.contactNumber || itAdmin.phoneNumber || "—"}
          />
        </div>
      </ModalSection>
    </BaseModal>
  );
}
