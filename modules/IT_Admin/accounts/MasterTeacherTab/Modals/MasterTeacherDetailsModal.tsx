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
      <ModalSection title="Personal Details">
        <div className="space-y-4">
          {/* 1st Row: Teacher ID and Role */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ModalInfoItem label="Teacher ID" value={masterTeacher.teacherId} />
            <ModalInfoItem label="Role" value={masterTeacher.roleLabel || masterTeacher.role || "Master Teacher"} />
          </div>
          
          {/* 2nd Row: Name fields */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ModalInfoItem label="First Name" value={masterTeacher.firstName ?? masterTeacher.first_name ?? ""} />
            <ModalInfoItem label="Middle Name" value={masterTeacher.middleName ?? masterTeacher.middle_name ?? ""} />
            <ModalInfoItem label="Last Name" value={masterTeacher.lastName ?? masterTeacher.last_name ?? ""} />
            <ModalInfoItem label="Suffix" value={masterTeacher.suffix ?? masterTeacher.suffix_name ?? masterTeacher.suf ?? ""} />
          </div>
        </div>
      </ModalSection>

      <ModalSection title="Contact Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Email" value={masterTeacher.email} />
          <ModalInfoItem label="Phone Number" value={masterTeacher.phoneNumber || masterTeacher.contactNumber} />
        </div>
      </ModalSection>

      <ModalSection title="Teaching Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem
            label="Grade Handled"
            value={
              Array.isArray(masterTeacher.coordinatorHandledGrades) && masterTeacher.coordinatorHandledGrades.length > 0
                ? masterTeacher.coordinatorHandledGrades.join(", ")
                : (masterTeacher.grade || masterTeacher.handledGrade || masterTeacher.handled_grade || "—")
            }
          />
          <ModalInfoItem
            label="Coordinator Subject"
            value={
              Array.isArray(masterTeacher.coordinatorHandledSubjects) && masterTeacher.coordinatorHandledSubjects.length > 0
                ? masterTeacher.coordinatorHandledSubjects.join(", ")
                : (masterTeacher.coordinatorSubject || "—")
            }
          />
          <ModalInfoItem
            label="Remedial Teacher Handled"
            value={
              Array.isArray(masterTeacher.remedialHandledSubjects) && masterTeacher.remedialHandledSubjects.length > 0
                ? masterTeacher.remedialHandledSubjects.join(", ")
                : (Array.isArray(masterTeacher.subjects)
                    ? masterTeacher.subjects.join(", ")
                    : (masterTeacher.subjects || masterTeacher.handledSubjects || masterTeacher.handled_subjects || "—")
                  )
            }
          />
        </div>
      </ModalSection>
    </BaseModal>
  );
}