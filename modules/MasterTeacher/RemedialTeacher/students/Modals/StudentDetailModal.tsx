import BaseModal, { ModalSection, ModalInfoItem } from "@/components/Common/Modals/BaseModal";

interface StudentDetailModalProps {
  show: boolean;
  onClose: () => void;
  student: any;
  onPromote?: (subject: "English" | "Filipino" | "Math") => void;
  promoteLoading?: boolean;
}

export default function StudentDetailModal({
  show,
  onClose,
  student,
  onPromote,
  promoteLoading = false,
}: StudentDetailModalProps) {
  if (!show || !student) return null;

  const footer = (
    <div className="flex flex-wrap gap-3 justify-end">
      <button
        onClick={onClose}
        className="bg-[#013300] text-white px-6 py-2 rounded-lg hover:bg-[#013300]/90 transition-colors font-medium"
      >
        Close
      </button>
    </div>
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
          <ModalInfoItem label="Grade" value={student.grade} />
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
              ""
            }
          />
          <ModalInfoItem
            label="Middle Name"
            value={
              student.parentMiddleName ??
              student.parent_middle_name ??
              student.guardianMiddleName ??
              student.guardian_middle_name ??
              ""
            }
          />
          <ModalInfoItem
            label="Last Name"
            value={
              student.parentLastName ??
              student.parent_last_name ??
              student.guardianLastName ??
              student.guardian_last_name ??
              ""
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
              ""
            }
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <ModalInfoItem label="Relationship" value={student.relationship} />
          <ModalInfoItem label="Phone Number" value={student.guardianContact} />
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

      {onPromote && (
        <ModalSection title="Promote Level">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { subject: "English", level: student.englishPhonemic ?? student.english ?? "" },
              { subject: "Filipino", level: student.filipinoPhonemic ?? student.filipino ?? "" },
              { subject: "Math", level: student.mathProficiency ?? student.math ?? "" },
            ].map((item) => {
              const levelLabel = String(item.level ?? "").trim();
              const isAvailable = levelLabel.length > 0 && levelLabel.toLowerCase() !== "n/a";
              const isDisabled = promoteLoading || !isAvailable;
              return (
                <button
                  key={item.subject}
                  type="button"
                  onClick={() => onPromote(item.subject as "English" | "Filipino" | "Math")}
                  disabled={isDisabled}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                    isDisabled
                      ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                      : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{item.subject}</span>
                    <span className="text-xs text-gray-500">
                      {isAvailable ? `Current: ${levelLabel}` : "No level available"}
                    </span>
                  </div>
                  <span className="text-xs font-semibold">
                    {promoteLoading ? "Promoting..." : "Promote"}
                  </span>
                </button>
              );
            })}
          </div>
        </ModalSection>
      )}
    </BaseModal>
  );
}
