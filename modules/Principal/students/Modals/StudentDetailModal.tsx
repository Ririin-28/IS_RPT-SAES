import BaseModal, { ModalSection, ModalInfoItem } from "@/components/Common/Modals/BaseModal";

interface StudentDetailModalProps {
  show: boolean;
  onClose: () => void;
  student: any;
}

export default function StudentDetailModal({ show, onClose, student }: StudentDetailModalProps) {
  if (!show || !student) return null;

  const gradeLabel = student.gradeLabel ?? (student.gradeNumber ? `Grade ${student.gradeNumber}` : student.grade);

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <ModalInfoItem label="First Name" value={student.firstName ?? student.first_name ?? ""} />
          <ModalInfoItem label="Middle Name" value={student.middleName ?? student.middle_name ?? ""} />
          <ModalInfoItem label="Last Name" value={student.lastName ?? student.last_name ?? ""} />
          <ModalInfoItem label="Suffix" value={student.suffix ?? student.suffix_name ?? student.suf ?? ""} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <ModalInfoItem label="Grade" value={gradeLabel} />
          <ModalInfoItem label="Section" value={student.section} />
        </div>
      </ModalSection>

      <ModalSection title="Parent and Contact Information">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <ModalInfoItem
            label="First Name"
            value={
              student.parentFirstName ??
              student.parent_first_name ??
              student.guardianFirstName ??
              student.guardian_first_name ??
              "-"
            }
          />
          <ModalInfoItem
            label="Middle Name"
            value={
              student.parentMiddleName ??
              student.parent_middle_name ??
              student.guardianMiddleName ??
              student.guardian_middle_name ??
              "-"
            }
          />
          <ModalInfoItem
            label="Last Name"
            value={
              student.parentLastName ??
              student.parent_last_name ??
              student.guardianLastName ??
              student.guardian_last_name ??
              "-"
            }
          />
          <ModalInfoItem
            label="Suffix"
            value={
              student.parentSuffix ??
              student.parent_suffix ??
              student.guardianSuffix ??
              student.guardian_suffix ??
              student.guardian_suf ??
              "-"
            }
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <ModalInfoItem
            label="Relationship"
            value={
              student.parentRelationship ??
              student.parent_relationship ??
              student.relationship ??
              "-"
            }
          />
          <ModalInfoItem
            label="Phone Number"
            value={
              student.parentContactNumber ??
              student.parent_contact_number ??
              student.parentPhoneNumber ??
              student.parent_phone_number ??
              student.guardianContact ??
              student.guardianContactNumber ??
              student.guardian_contact_number ??
              "-"
            }
          />
          <ModalInfoItem
            label="Email"
            value={
              student.parentEmail ??
              student.parent_email ??
              student.guardianEmail ??
              student.guardian_email ??
              "-"
            }
          />
        </div>
        <div className="grid grid-cols-1">
          <ModalInfoItem
            label="Address"
            value={
              student.parentAddress ??
              student.parent_address ??
              student.guardianAddress ??
              student.guardian_address ??
              student.address ??
              "-"
            }
          />
        </div>
      </ModalSection>

      <ModalSection title="Assessment Levels">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ModalInfoItem label="English Phonemic" value={student.englishPhonemic ?? student.english_phonemic ?? "-"} />
          <ModalInfoItem label="Filipino Phonemic" value={student.filipinoPhonemic ?? student.filipino_phonemic ?? "-"} />
          <ModalInfoItem label="Math Proficiency" value={student.mathProficiency ?? student.math_proficiency ?? "-"} />
        </div>
      </ModalSection>
    </BaseModal>
  );
}