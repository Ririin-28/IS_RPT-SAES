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

  const resolveFullName = () => {
    const first = (student.firstName ?? "").trim();
    const middle = (student.middleName ?? "").trim();
    const last = (student.lastName ?? "").trim();
    const parts = [first, middle, last].filter((part) => part.length > 0);
    if (parts.length) {
      return parts.join(" ");
    }

    const fallback = (student.name ?? "").trim();
    if (!fallback) return "";

    const commaParts = fallback.split(",").map((part) => part.trim()).filter(Boolean);
    if (commaParts.length >= 2) {
      const lastName = commaParts[0];
      const firstAndMiddle = commaParts[1] ?? "";
      const firstParts = firstAndMiddle.split(/\s+/).filter(Boolean);
      const firstName = firstParts[0] ?? "";
      const middleFromFirst = firstParts.slice(1).join(" ");
      const middleFromComma = commaParts.slice(2).join(" ");
      const middleName = [middleFromFirst, middleFromComma].filter(Boolean).join(" ");
      return [firstName, middleName, lastName].filter(Boolean).join(" ");
    }

    return fallback;
  };

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ModalInfoItem label="Full Name" value={resolveFullName()} />
          <ModalInfoItem label="Grade" value={student.grade} />
          <ModalInfoItem label="Section" value={student.section} />
        </div>
      </ModalSection>

      <ModalSection title="Contact Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <ModalInfoItem label="Guardian Name" value={student.guardian} />
          <ModalInfoItem label="Relationship" value={student.relationship} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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