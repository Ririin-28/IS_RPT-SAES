import BaseModal, { ModalSection, ModalLabel } from "@/components/Common/Modals/BaseModal";
import { UseFormReturn } from "react-hook-form";
import { useState, useEffect } from "react";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";

interface AddTeacherModalProps {
  show: boolean;
  onClose: () => void;
  form: UseFormReturn<any>;
  onSubmit: (data: any) => void;
}

export default function AddTeacherModal({ show, onClose, form, onSubmit }: AddTeacherModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = form;
  
  const [teacherIdValue, setTeacherIdValue] = useState("");
  
  const teacherId = watch("teacherId");

  useEffect(() => {
    if (teacherId) {
      const digits = teacherId.replace(/\D/g, "");
      let formatted = digits;
      
      if (digits.length > 4) {
        formatted = `${digits.slice(0, 4)}-${digits.slice(4, 8)}`;
      } else if (digits.length === 4) {
        formatted = digits;
      }
      
      setTeacherIdValue(formatted);
      setValue("teacherId", formatted, { shouldValidate: true });
    }
  }, [teacherId, setValue]);

  const handleClose = () => {
    onClose();
    reset();
    setTeacherIdValue("");
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
        Save Teacher
      </PrimaryButton>
    </>
  );

  return (
    <BaseModal
      show={show}
      onClose={handleClose}
      title="Add New Teacher"
      footer={footer}
    >
      <form id="add-teacher-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <ModalSection title="Personal Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <ModalLabel required>Teacher ID</ModalLabel>
              <input
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                placeholder="1000-001"
                value={teacherIdValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setTeacherIdValue(value);
                  setValue("teacherId", value, { shouldValidate: true });
                }}
                onKeyDown={(e) => {
                  if (!/[\d-]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
              {errors.teacherId && <span className="text-red-500 text-xs">{errors.teacherId.message as string}</span>}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Full Name</ModalLabel>
              <input
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                placeholder="Surname, Firstname, M.I."
                onInput={(e) => {
                  const target = e.target as HTMLInputElement;
                  target.value = target.value.replace(/[^A-Za-z\s,.-]/g, '');
                }}
                {...register("name", { 
                  required: "Full Name is required",
                  pattern: {
                    value: /^[A-Za-z\s,.-]+$/,
                    message: "Name must contain only letters, spaces, commas, periods, and hyphens"
                  }
                })}
              />
              {errors.name && <span className="text-red-500 text-xs">{errors.name.message as string}</span>}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Email</ModalLabel>
              <input
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                placeholder="juandelacruz@email.com"
                type="email"
                {...register("email", { 
                  required: "Email is required",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Please enter a valid email address"
                  }
                })}
              />
              {errors.email && <span className="text-red-500 text-xs">{errors.email.message as string}</span>}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Contact Number</ModalLabel>
              <input
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                placeholder="0900-000-0000"
                {...register("contactNumber", { 
                  required: "Contact number is required",
                  pattern: {
                    value: /^\d{4}-\d{3}-\d{4}$/,
                    message: "Contact number must be in format: 0000-000-0000"
                  }
                })}
              />
              {errors.contactNumber && <span className="text-red-500 text-xs">{errors.contactNumber.message as string}</span>}
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Teaching Information">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <ModalLabel required>Grade</ModalLabel>
              <select
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                {...register("grade", { required: "Grade is required" })}
              >
                <option value="" disabled>Select grade</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
              </select>
              {errors.grade && <span className="text-red-500 text-xs">{errors.grade.message as string}</span>}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Subject</ModalLabel>
              <select
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                {...register("subject", { required: "Subject is required" })}
              >
                <option value="" disabled>Select subject</option>
                <option value="Math">Math</option>
                <option value="English">English</option>
                <option value="Filipino">Filipino</option>
              </select>
              {errors.subject && <span className="text-red-500 text-xs">{errors.subject.message as string}</span>}
            </div>
            <div className="space-y-1">
              <ModalLabel>Sections</ModalLabel>
              <input
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                placeholder="Aguinaldo, Del Pilar"
                {...register("sections")}
              />
              {errors.sections && <span className="text-red-500 text-xs">{errors.sections.message as string}</span>}
            </div>
          </div>
        </ModalSection>
      </form>
    </BaseModal>
  );
}