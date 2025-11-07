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
      title="IT Admin Details"
      maxWidth="2xl"
      footer={footer}
    >
      <ModalSection title="Personal Details">
        <div className="space-y-4">
          {/* 1st Row: IT Admin ID and Role */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ModalInfoItem label="IT Admin ID" value={itAdmin.userId || itAdmin.user_id || itAdmin.adminId || itAdmin.itAdminId} />
            <ModalInfoItem label="Role" value={itAdmin.roleLabel || itAdmin.role || "IT Admin"} />
          </div>
          
          {/* 2nd Row: Full Name with helper text */}
          <div className="space-y-1">
            <ModalInfoItem 
              label="Full Name" 
              value={itAdmin.name || itAdmin.fullName} 
            />
            <p className="text-xs text-gray-500 pl-1">Format: First, Middle, Last, Suffix</p>
          </div>
        </div>
      </ModalSection>

      <ModalSection title="Contact Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Email" value={itAdmin.email || itAdmin.user_email || itAdmin.contactEmail || "—"} />
          <ModalInfoItem
            label="Phone Number"
            value={itAdmin.contactNumber || itAdmin.contact_number || itAdmin.contactNo || itAdmin.phoneNumber || itAdmin.phone || itAdmin.mobile || "—"}
          />
        </div>
      </ModalSection>

      <ModalSection title="Archive Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Archived Date" value={itAdmin.archivedDateDisplay || "—"} />
          <ModalInfoItem label="Reason" value={itAdmin.reason || "—"} />
        </div>
      </ModalSection>
    </BaseModal>
  );
}
