import { useState } from "react";
import BaseModal, { ModalSection, ModalInfoItem } from "@/components/Common/Modals/BaseModal";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";

interface StudentDetailModalProps {
  show: boolean;
  onClose: () => void;
  student: any;
  onEdit?: (student: any) => void;
}

export default function StudentDetailModal({ show, onClose, student, onEdit }: StudentDetailModalProps) {
  if (!show || !student) return null;

  const footer = (
    <>
      {onEdit && (
        <UtilityButton onClick={() => onEdit(student)}>
          Edit
        </UtilityButton>
      )}
      <button
        onClick={onClose}
        className="bg-[#013300] text-white px-6 py-2 rounded-lg hover:bg-[#013300]/90 transition-colors font-medium"
      >
        Close
      </button>
    </>
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
          <ModalInfoItem label="Contact Number" value={student.guardianContact} />
          <ModalInfoItem label="Email" value={student.guardianEmail} />
        </div>
        <div className="grid grid-cols-1">
          <ModalInfoItem label="Address" value={student.address} />
        </div>
      </ModalSection>

      <ModalSection title="Assessment Level Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalInfoItem label="Subject Assigned" value={student.subjectAssigned || 'N/A'} />
          <ModalInfoItem 
            label="Phonemic" 
            value={
              student.subjectAssigned?.toLowerCase() === 'english' ? (student.englishPhonemic || 'N/A') :
              student.subjectAssigned?.toLowerCase() === 'filipino' ? (student.filipinoPhonemic || 'N/A') :
              student.subjectAssigned?.toLowerCase() === 'math' ? (student.mathProficiency || 'N/A') :
              (student.englishPhonemic || student.filipinoPhonemic || student.mathProficiency || 'N/A')
            } 
          />
        </div>
      </ModalSection>
    </BaseModal>
  );
}