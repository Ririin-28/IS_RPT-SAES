import BaseModal, { ModalSection, ModalInfoItem, ModalLabel } from "@/components/Common/Modals/BaseModal";

interface UserDetailModalProps {
  show: boolean;
  onClose: () => void;
  user: any;
}

export default function UserDetailModal({ show, onClose, user }: UserDetailModalProps) {
  if (!show || !user) return null;

  // Split subjects and sections into arrays
  const subjectsList = user.subjects
    ? user.subjects.split(',').map((subject: string) => subject.trim())
    : [];

  const sectionsList = user.sections
    ? user.sections.split(',').map((section: string) => section.trim())
    : [];

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
      title="User Details"
      maxWidth="2xl"
      footer={footer}
    >
      <ModalSection title="Personal Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="User ID" value={user.userId} />
          <ModalInfoItem label="Full Name" value={user.name} />
          <ModalInfoItem label="Email" value={user.email} />
          <ModalInfoItem label="Contact Number" value={user.contactNumber} />
        </div>
      </ModalSection>

      <ModalSection title="Teaching Information">
        <div className="grid grid-cols-3 gap-4">
          <ModalInfoItem label="Handled Grade" value={user.grade} />

          {/* Handled Sections with consistent formatting */}
          <div className="space-y-1">
            <ModalLabel>Handled Sections</ModalLabel>
            <div className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-md px-3 py-2 text-sm">
              {sectionsList.length > 0 ? (
                <ul className="list-disc list-inside">
                  {sectionsList.map((section: string, index: number) => (
                    <li key={index}>{section}</li>
                  ))}
                </ul>
              ) : (
                "-"
              )}
            </div>
          </div>

          {/* Handled Subjects with consistent formatting */}
          <div className="space-y-1">
            <ModalLabel>Handled Subjects</ModalLabel>
            <div className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-md px-3 py-2 text-sm">
              {subjectsList.length > 0 ? (
                <ul className="list-disc list-inside">
                  {subjectsList.map((subject: string, index: number) => (
                    <li key={index}>{subject}</li>
                  ))}
                </ul>
              ) : (
                "-"
              )}
            </div>
          </div>
        </div>
      </ModalSection>
    </BaseModal>
  );
}
