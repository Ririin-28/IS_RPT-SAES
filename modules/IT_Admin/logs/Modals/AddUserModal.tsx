"use client";
import BaseModal, { ModalSection, ModalLabel } from "@/components/Common/Modals/BaseModal";
import { UseFormReturn } from "react-hook-form";
import { useState, useEffect } from "react";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";

interface AddUserModalProps {
  show: boolean;
  onClose: () => void;
  form: UseFormReturn<any>;
  onSubmit: (data: any) => void;
}

export default function AddUserModal({ show, onClose, form, onSubmit }: AddUserModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = form;
  
  const [contactValue, setContactValue] = useState("");
  
  const contact = watch("contact");

  useEffect(() => {
    if (contact) {
      const digits = contact.replace(/\D/g, "");
      let formatted = digits;
      
      if (digits.length > 4 && digits.length <= 7) {
        formatted = `${digits.slice(0, 4)}-${digits.slice(4, 7)}`;
      } else if (digits.length > 7) {
        formatted = `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
      }
      
      setContactValue(formatted);
      setValue("contact", formatted, { shouldValidate: true });
    }
  }, [contact, setValue]);

  const handleClose = () => {
    onClose();
    reset();
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
        Add User
      </PrimaryButton>
    </>
  );

  return (
    <BaseModal
      show={show}
      onClose={handleClose}
      title="Add New User"
      footer={footer}
    >
      <form id="add-user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <ModalSection title="Personal Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <ModalLabel required>User ID</ModalLabel>
              <input
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                placeholder="Enter user ID"
                {...register("userId", { required: "User ID is required" })}
              />
              {errors.userId && <span className="text-red-500 text-xs">{errors.userId.message as string}</span>}
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
          </div>
        </ModalSection>

        <ModalSection title="Contact Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <ModalLabel required>Email Address</ModalLabel>
              <input
                type="email"
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                placeholder="user@example.com"
                {...register("email", { 
                  required: "Email is required",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Invalid email format"
                  }
                })}
              />
              {errors.email && <span className="text-red-500 text-xs">{errors.email.message as string}</span>}
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
                  setValue("contact", value, { shouldValidate: true });
                }}
                onKeyDown={(e) => {
                  if (!/[\d-]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
              {errors.contact && <span className="text-red-500 text-xs">{errors.contact.message as string}</span>}
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Account Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <ModalLabel required>Role</ModalLabel>
              <select
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                {...register("role", { required: "Role is required" })}
              >
                <option value="" disabled>Select role</option>
                <option value="Admin">Admin</option>
                <option value="Teacher">Teacher</option>
                <option value="Parent">Parent</option>
                <option value="Principal">Principal</option>
              </select>
              {errors.role && <span className="text-red-500 text-xs">{errors.role.message as string}</span>}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Status</ModalLabel>
              <select
                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                {...register("status", { required: "Status is required" })}
              >
                <option value="" disabled>Select status</option>
                <option value="Active">Active</option>
                <option value="Disabled">Disabled</option>
              </select>
              {errors.status && <span className="text-red-500 text-xs">{errors.status.message as string}</span>}
            </div>
          </div>
        </ModalSection>
      </form>
    </BaseModal>
  );
}