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
      <ModalSection title="Personal Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Principal ID" value={principal.principalId} />
          <ModalInfoItem label="Full Name" value={principal.name} />
          <ModalInfoItem label="Email" value={principal.email} />
          <ModalInfoItem label="Contact Number" value={principal.contactNumber} />
        </div>
      </ModalSection>
    </BaseModal>
  );
}