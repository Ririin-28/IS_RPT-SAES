import BaseModal, { ModalSection, ModalInfoItem } from "@/components/Common/Modals/BaseModal";

interface StudentDetailModalProps {
  show: boolean;
  onClose: () => void;
  student: any;
}

export default function StudentDetailModal({ show, onClose, student }: StudentDetailModalProps) {
  if (!show || !student) return null;

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
      title="Student Details"
      maxWidth="2xl"
      footer={footer}
    >
      <ModalSection title="Personal Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Student ID" value={student.studentId} />
          <ModalInfoItem label="Full Name" value={student.name} />
          <ModalInfoItem label="Grade" value={student.grade} />
          <ModalInfoItem label="Section" value={student.section} />
        </div>
      </ModalSection>

      <ModalSection title="Contact Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <ModalInfoItem label="Address" value={student.address} />
          </div>
          <ModalInfoItem label="Guardian" value={student.guardian} />
          <ModalInfoItem label="Guardian Contact" value={student.guardianContact} />
        </div>
      </ModalSection>

      <ModalSection title="Assessment Level Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Subject Assigned" value={student.subjectAssigned || 'N/A'} />
          <ModalInfoItem label="Phonemic" value={student.englishPhonemic || student.filipinoPhonemic || student.mathProficiency || 'N/A'} />
        </div>
      </ModalSection>
    </BaseModal>
  );
}