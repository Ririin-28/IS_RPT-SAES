import BaseModal, { ModalSection, ModalLabel } from "@/components/Common/Modals/BaseModal";
import { UseFormReturn } from "react-hook-form";
import { useState, useEffect } from "react";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";

interface AddStudentModalProps {
  show: boolean;
  onClose: () => void;
  form: UseFormReturn<any>;
  onSubmit: (data: any) => void;
}

export default function AddStudentModal({ show, onClose, form, onSubmit }: AddStudentModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = form;
  
  const [studentIdValue, setStudentIdValue] = useState("");
  const [contactValue, setContactValue] = useState("");
  
  const studentId = watch("studentId");
  const guardianContact = watch("guardianContact");

  useEffect(() => {
    if (studentId) {
      const digits = studentId.replace(/\D/g, "");
      let formatted = digits;
      
      if (digits.length > 4) {
        formatted = `${digits.slice(0, 4)}-${digits.slice(4, 8)}`;
      } else if (digits.length === 4) {
        formatted = digits;
      }
      
      setStudentIdValue(formatted);
      setValue("studentId", formatted, { shouldValidate: true });
    }
  }, [studentId, setValue]);
  
  useEffect(() => {
    if (guardianContact) {
      const digits = guardianContact.replace(/\D/g, "");
      let formatted = digits;
      
      if (digits.length > 4 && digits.length <= 7) {
        formatted = `${digits.slice(0, 4)}-${digits.slice(4, 7)}`;
      } else if (digits.length > 7) {
        formatted = `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
      }
      
      setContactValue(formatted);
      setValue("guardianContact", formatted, { shouldValidate: true });
    }
  }, [guardianContact, setValue]);

  const handleClose = () => {
    onClose();
    reset();
    setStudentIdValue("");
    setContactValue("");
  };

  const footer = (
    <>
      <DangerButton
        type="button"
        onClick={handleClose}>
        Cancel
      </DangerButton>
      <PrimaryButton 
        type="submit">
        Save Student
      </PrimaryButton>
    </>
  );

  return (
    <BaseModal
      show={show}
      onClose={handleClose}
      title="Add New Student"
      footer={footer}
    >
      <form id="add-student-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <ModalSection title="Personal Information">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <ModalLabel required>Student ID</ModalLabel>
              <input
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                placeholder="2023-0003"
                value={studentIdValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setStudentIdValue(value);
                  setValue("studentId", value, { shouldValidate: true });
                }}
                onKeyDown={(e) => {
                  if (!/[\d-]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
              {errors.studentId && <span className="text-red-500 text-xs">{errors.studentId.message as string}</span>}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Full Name</ModalLabel>
              <input
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                placeholder="Surname, Firstname M.I."
                {...register("name", { required: "Full name is required" })}
              />
              {errors.name && <span className="text-red-500 text-xs">{errors.name.message as string}</span>}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Age</ModalLabel>
              <input
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                placeholder="10"
                type="number"
                min="5"
                {...register("age", { 
                  required: "Age is required",
                  min: { value: 5, message: "Age must be at least 5 years old" },
                  valueAsNumber: true
                })}
              />
              {errors.age && <span className="text-red-500 text-xs">{errors.age.message as string}</span>}
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Academic Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <ModalLabel required>Grade Level</ModalLabel>
              <select
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                {...register("grade", { required: "Grade level is required" })}
              >
                <option value="" disabled>Select grade</option>
                {[1, 2, 3, 4, 5, 6].map((grade) => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
              {errors.grade && <span className="text-red-500 text-xs">{errors.grade.message as string}</span>}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Section</ModalLabel>
              <select
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                {...register("section", { required: "Section is required" })}
              >
                <option value="" disabled>Select section</option>
                {["A", "B", "C", "D", "E", "F"].map((section) => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
              {errors.section && <span className="text-red-500 text-xs">{errors.section.message as string}</span>}
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Contact Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <ModalLabel required>Guardian</ModalLabel>
              <input
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                placeholder="Surname, Firstname M.I."
                {...register("guardian", { required: "Guardian name is required" })}
              />
              {errors.guardian && <span className="text-red-500 text-xs">{errors.guardian.message as string}</span>}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Contact Number</ModalLabel>
              <input
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                placeholder="0912-345-6789"
                value={contactValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setContactValue(value);
                  setValue("guardianContact", value, { shouldValidate: true });
                }}
                onKeyDown={(e) => {
                  if (!/[\d-]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
              {errors.guardianContact && <span className="text-red-500 text-xs">{errors.guardianContact.message as string}</span>}
            </div>
            <div className="space-y-1 md:col-span-2">
              <ModalLabel required>Address</ModalLabel>
              <input
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                placeholder="Brgy. Example, City, Province"
                {...register("address", { required: "Address is required" })}
              />
              {errors.address && <span className="text-red-500 text-xs">{errors.address.message as string}</span>}
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Assessment Levels">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <ModalLabel required>English</ModalLabel>
              <select
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                {...register("englishPhonemic", { required: "English assessment level is required" })}
              >
                <option value="" disabled>Select level</option>
                <option value="-">- (Not Assessed)</option>
                <option value="Non-Reader">Non-Reader</option>
                <option value="Syllable">Syllable</option>
                <option value="Word">Word</option>
                <option value="Sentence">Sentence</option>
                <option value="Paragraph">Paragraph</option>
              </select>
              {errors.englishPhonemic && <span className="text-red-500 text-xs">{errors.englishPhonemic.message as string}</span>}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Filipino</ModalLabel>
              <select
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                {...register("filipinoPhonemic", { required: "Filipino assessment level is required" })}
              >
                <option value="" disabled>Select level</option>
                <option value="-">- (Not Assessed)</option>
                <option value="Non-Reader">Non-Reader</option>
                <option value="Syllable">Syllable</option>
                <option value="Word">Word</option>
                <option value="Sentence">Sentence</option>
                <option value="Paragraph">Paragraph</option>
              </select>
              {errors.filipinoPhonemic && <span className="text-red-500 text-xs">{errors.filipinoPhonemic.message as string}</span>}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Math</ModalLabel>
              <select
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                {...register("mathProficiency", { required: "Math assessment level is required" })}
              >
                <option value="" disabled>Select level</option>
                <option value="-">- (Not Assessed)</option>
                <option value="Non-Proficient">Non-Proficient</option>
              </select>
              {errors.mathProficiency && <span className="text-red-500 text-xs">{errors.mathProficiency.message as string}</span>}
            </div>
          </div>
        </ModalSection>
      </form>
    </BaseModal>
  );
}