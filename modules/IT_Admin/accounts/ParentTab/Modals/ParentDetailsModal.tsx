import BaseModal, { ModalInfoItem, ModalSection } from "@/components/Common/Modals/BaseModal";

interface ParentDetailsModalProps {
  show: boolean;
  onClose: () => void;
  parent: any;
}

export default function ParentDetailsModal({ show, onClose, parent }: ParentDetailsModalProps) {
  if (!show || !parent) return null;

  const linkedStudents = Array.isArray(parent.linkedStudents) ? parent.linkedStudents : [];

  const footer = (
    <button
      onClick={onClose}
      className="rounded-lg bg-[#013300] px-6 py-2 font-medium text-white transition-colors hover:bg-[#013300]/90"
    >
      Close
    </button>
  );

  return (
    <BaseModal
      show={show}
      onClose={onClose}
      title="Parent Details"
      maxWidth="2xl"
      footer={footer}
    >
      <ModalSection title="Account Summary">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ModalInfoItem label="Parent ID" value={parent.parentId} />
          <ModalInfoItem label="Students" value={parent.linkedStudentsCount ?? linkedStudents.length} />
        </div>
      </ModalSection>

      <ModalSection title="Personal Details">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <ModalInfoItem label="First Name" value={parent.firstName} />
          <ModalInfoItem label="Middle Name" value={parent.middleName} />
          <ModalInfoItem label="Last Name" value={parent.lastName} />
          <ModalInfoItem label="Suffix" value={parent.suffix} />
        </div>
      </ModalSection>

      <ModalSection title="Contact Details">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ModalInfoItem label="Email" value={parent.email} />
          <ModalInfoItem label="Contact Number" value={parent.contactNumberLocal ?? parent.contactNumber} />
        </div>
        <div className="grid grid-cols-1">
          <ModalInfoItem label="Address" value={parent.address} />
        </div>
      </ModalSection>

      <ModalSection title="Student Information">
        <div className="space-y-4">
          {linkedStudents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              No students found for this parent account.
            </div>
          ) : (
            <div className="space-y-6">
              {linkedStudents.map((student: any, index: number) => (
                <div
                  key={`${student.studentId ?? "student"}-${index}`}
                  className={index === 0 ? "space-y-4" : "space-y-4 border-t border-gray-200 pt-6"}
                >
                  <div className="border-b border-gray-200 pb-2">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-800">
                      Student {index + 1}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <ModalInfoItem label="LRN" value={student.lrn} />
                    <ModalInfoItem label="Student ID" value={student.studentId} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <ModalInfoItem label="First Name" value={student.firstName} />
                    <ModalInfoItem label="Middle Name" value={student.middleName} />
                    <ModalInfoItem label="Last Name" value={student.lastName} />
                    <ModalInfoItem label="Suffix" value={student.suffix} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <ModalInfoItem label="Grade" value={student.grade} />
                    <ModalInfoItem label="Section" value={student.section} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ModalSection>
    </BaseModal>
  );
}
