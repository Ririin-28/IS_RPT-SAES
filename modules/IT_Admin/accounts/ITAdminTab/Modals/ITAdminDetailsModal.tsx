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
            <ModalInfoItem label="IT Admin ID" value={itAdmin.itAdminId || itAdmin.adminId} />
            <ModalInfoItem label="Role" value={itAdmin.role || "IT Admin"} />
          </div>
          
          {/* 2nd Row: Full Name with helper text */}
          <div className="space-y-1">
            <ModalInfoItem 
              label="Full Name" 
              value={itAdmin.fullName || itAdmin.name} 
            />
            <p className="text-xs text-gray-500 pl-1">Format: First, Middle, Last, Suffix</p>
          </div>
        </div>
      </ModalSection>

      <ModalSection title="Contact Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Email" value={itAdmin.email} />
          <ModalInfoItem label="Phone Number" value={itAdmin.phoneNumber} />
        </div>
      </ModalSection>
    </BaseModal>
  );
}