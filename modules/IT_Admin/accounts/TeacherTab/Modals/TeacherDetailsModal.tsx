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
      <ModalSection title="Personal Details">
        <div className="space-y-4">
          {/* 1st Row: Teacher ID and Role */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ModalInfoItem label="Teacher ID" value={teacher.teacherId} />
            <ModalInfoItem label="Role" value={teacher.roleLabel || teacher.role || "Teacher"} />
          </div>
          
          {/* 2nd Row: Full Name with helper text */}
          <div className="space-y-1">
            <ModalInfoItem 
              label="Full Name" 
              value={teacher.fullName || teacher.name} 
            />
            <p className="text-xs text-gray-500 pl-1">Format: Last, First, Middle, Suffix</p>
          </div>
        </div>
      </ModalSection>

      <ModalSection title="Contact Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Email" value={teacher.email} />
          <ModalInfoItem label="Phone Number" value={teacher.phoneNumber || teacher.contactNumber} />
        </div>
      </ModalSection>

      <ModalSection title="Teaching Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Grade Handled" value={teacher.grade || teacher.handledGrade} />
          <ModalInfoItem 
            label="Subjects Handled" 
            value={teacher.subjects || "English, Filipino, Math"}
          />
        </div>
      </ModalSection>
    </BaseModal>
  );
}