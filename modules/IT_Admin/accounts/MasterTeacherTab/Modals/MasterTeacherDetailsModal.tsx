import BaseModal, { ModalSection, ModalInfoItem } from "@/components/Common/Modals/BaseModal";

interface MasterTeacherDetailsModalProps {
  show: boolean;
  onClose: () => void;
  masterTeacher: any;
}

export default function MasterTeacherDetailsModal({ show, onClose, masterTeacher }: MasterTeacherDetailsModalProps) {
  if (!show || !masterTeacher) return null;

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
      title="Master Teacher Details"
      maxWidth="2xl"
      footer={footer}
    >
      <ModalSection title="Personal Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Teacher ID" value={masterTeacher.teacherId} />
          <ModalInfoItem label="Full Name" value={masterTeacher.name} />
          <ModalInfoItem label="Email" value={masterTeacher.email} />
          <ModalInfoItem label="Contact Number" value={masterTeacher.contactNumber} />
        </div>
      </ModalSection>

      <ModalSection title="Teaching Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Grade" value={masterTeacher.grade} />
        </div>
      </ModalSection>
    </BaseModal>
  );
}