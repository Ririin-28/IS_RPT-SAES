import BaseModal, { ModalSection, ModalInfoItem } from "@/components/Common/Modals/BaseModal";

interface StudentDetailModalProps {
  show: boolean;
  onClose: () => void;
  student: any;
}

export default function StudentDetailModal({ show, onClose, student }: StudentDetailModalProps) {
  if (!show || !student) return null;

  const gradeLabel = student.gradeLabel ?? (student.gradeNumber ? `Grade ${student.gradeNumber}` : student.grade);
  const fullName = student.name || [student.firstName, student.middleName, student.lastName, student.suffix]
    .filter(Boolean)
    .join(" ");

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
          <ModalInfoItem label="LRN" value={student.lrn} />
          <ModalInfoItem label="Full Name" value={fullName} />
          <ModalInfoItem label="Suffix" value={student.suffix} />
        </div>
      </ModalSection>

      <ModalSection title="Academic Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Grade" value={gradeLabel} />
          <ModalInfoItem label="Section" value={student.section} />
        </div>
      </ModalSection>

      <ModalSection title="Parent Information">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            label="Relationship"
            value={
              student.parentRelationship ??
              student.parent_relationship ??
              student.relationship ??
              "-"
            }
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <ModalInfoItem
            label="Contact Number"
            value={
              student.parentContactNumber ??
              student.parent_contact_number ??
              student.parentPhoneNumber ??
              student.parent_phone_number ??
              student.guardianContactNumber ??
              student.guardian_contact_number ??
              "-"
            }
          />
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
          <ModalInfoItem
            label="Username"
            value={
              student.parentUsername ??
              student.parent_username ??
              student.guardianUsername ??
              student.guardian_username ??
              "-"
            }
          />
        </div>
      </ModalSection>
    </BaseModal>
  );
}