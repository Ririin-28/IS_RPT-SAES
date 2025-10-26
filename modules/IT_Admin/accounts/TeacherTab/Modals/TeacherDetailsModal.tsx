import BaseModal, { ModalSection, ModalInfoItem } from "@/components/Common/Modals/BaseModal";

interface TeacherDetailsModalProps {
  show: boolean;
  onClose: () => void;
  teacher: any;
}

export default function TeacherDetailsModal({ show, onClose, teacher }: TeacherDetailsModalProps) {
  if (!show || !teacher) return null;

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
      title="Teacher Details"
      maxWidth="2xl"
      footer={footer}
    >
      <ModalSection title="Personal Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Teacher ID" value={teacher.teacherId} />
          <ModalInfoItem label="Full Name" value={teacher.name} />
          <ModalInfoItem label="Email" value={teacher.email} />
          <ModalInfoItem label="Contact Number" value={teacher.contactNumber} />
        </div>
      </ModalSection>

      <ModalSection title="Teaching Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Grade" value={teacher.grade} />
          <ModalInfoItem label="Section" value={teacher.section} />
        </div>
      </ModalSection>
    </BaseModal>
  );
}