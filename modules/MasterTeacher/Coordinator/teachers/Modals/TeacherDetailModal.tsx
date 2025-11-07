import BaseModal, { ModalSection, ModalInfoItem, ModalLabel } from "@/components/Common/Modals/BaseModal";

interface TeacherDetailModalProps {
  show: boolean;
  onClose: () => void;
  teacher: any;
}

const DEFAULT_SUBJECTS = ["English", "Filipino", "Math"];

export default function TeacherDetailModal({ show, onClose, teacher }: TeacherDetailModalProps) {
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ModalInfoItem label="Handled Grade" value={teacher.grade} />
          {/* Handled Subjects with consistent formatting */}
          <div className="space-y-1">
            <ModalLabel>Handled Subjects</ModalLabel>
            <div className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-md px-3 py-2 text-sm">
              <ul className="list-disc list-inside">
                {DEFAULT_SUBJECTS.map((subject) => (
                  <li key={subject}>{subject}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </ModalSection>
    </BaseModal>
  );
}