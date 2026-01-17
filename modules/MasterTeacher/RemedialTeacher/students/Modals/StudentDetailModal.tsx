import BaseModal, { ModalSection, ModalInfoItem } from "@/components/Common/Modals/BaseModal";

interface StudentDetailModalProps {
  show: boolean;
  onClose: () => void;
  student: any;
}

export default function StudentDetailModal({ show, onClose, student }: StudentDetailModalProps) {
  if (!show || !student) return null;

  const resolveFullName = () => {
    const first = (student.firstName ?? "").trim();
    const middle = (student.middleName ?? "").trim();
    const last = (student.lastName ?? "").trim();
    const parts = [first, middle, last].filter((part) => part.length > 0);
    if (parts.length) {
      return parts.join(" ");
    }

    const fallback = (student.name ?? "").trim();
    if (!fallback) return "";

    const commaMatch = fallback.match(/^\s*([^,]+)\s*,\s*(.+)$/);
    if (commaMatch) {
      const lastName = commaMatch[1].trim();
      const remainder = commaMatch[2].trim();
      const remainderParts = remainder.split(/\s+/).filter(Boolean);
      if (remainderParts.length) {
        const firstName = remainderParts[0];    
        const middleParts = remainderParts.slice(1).map((value: string) => value.replace(/\.$/, ""));
        return [firstName, ...middleParts, lastName].filter(Boolean).join(" ");
      }
    }

    return fallback;
  };

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <ModalInfoItem label="LRN" value={student.lrn} />
          <ModalInfoItem label="Student ID" value={student.studentId} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ModalInfoItem label="Full Name" value={resolveFullName()} />
          <ModalInfoItem label="Grade" value={student.grade} />
          <ModalInfoItem label="Section" value={student.section} />
        </div>
      </ModalSection>

      <ModalSection title="Contact Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <ModalInfoItem label="Guardian Name" value={student.guardian} />
          <ModalInfoItem label="Relationship" value={student.relationship} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <ModalInfoItem label="Contact Number" value={student.guardianContact} />
          <ModalInfoItem label="Email" value={student.guardianEmail} />
        </div>
        <div className="grid grid-cols-1">
          <ModalInfoItem label="Address" value={student.address} />
        </div>
      </ModalSection>

      <ModalSection title="Assessment Levels">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ModalInfoItem label="English Phonemic" value={student.englishPhonemic} />
          <ModalInfoItem label="Filipino Phonemic" value={student.filipinoPhonemic} />
          <ModalInfoItem label="Math Proficiency" value={student.mathProficiency} />
        </div>
      </ModalSection>
    </BaseModal>
  );
}