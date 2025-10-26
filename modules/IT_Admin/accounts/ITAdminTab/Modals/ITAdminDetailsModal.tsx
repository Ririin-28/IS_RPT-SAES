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
      <ModalSection title="Personal Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="IT Admin ID" value={itAdmin.adminId} />
          <ModalInfoItem label="Full Name" value={itAdmin.name} />
          <ModalInfoItem label="Email" value={itAdmin.email} />
          <ModalInfoItem label="Contact Number" value={itAdmin.phoneNumber} />
        </div>
      </ModalSection>
    </BaseModal>
  );
}