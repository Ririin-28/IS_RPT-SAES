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
            <ModalInfoItem label="Role" value={masterTeacher.role || "Master Teacher"} />
          </div>
          
          {/* 2nd Row: Full Name with helper text */}
          <div className="space-y-1">
            <ModalInfoItem 
              label="Full Name" 
              value={masterTeacher.fullName || masterTeacher.name} 
            />
            <p className="text-xs text-gray-500 pl-1">Format: First, Middle, Last, Suffix</p>
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
          <ModalInfoItem label="Grade Handled" value={masterTeacher.grade || masterTeacher.handledGrade || masterTeacher.handled_grade} />
          <ModalInfoItem label="Subjects Handled" value={
            Array.isArray(masterTeacher.subjects) 
              ? masterTeacher.subjects.join(", ") 
              : (masterTeacher.subjects || masterTeacher.handledSubjects || masterTeacher.handled_subjects || "—")
          } />
        </div>
      </ModalSection>
    </BaseModal>
  );
}