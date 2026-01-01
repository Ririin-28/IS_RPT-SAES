"use client";

import BaseModal, { ModalLabel, ModalSection } from "@/components/Common/Modals/BaseModal";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import { useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

export interface AddMasterTeacherFormValues {
  teacherId: string;
  role: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  email: string;
  phoneNumber: string;
  grade: string;
  coordinatorSubject: string;
  subjects: string[];
}

interface AddMasterTeacherModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (values: AddMasterTeacherFormValues) => void | Promise<void>;
  form: UseFormReturn<AddMasterTeacherFormValues>;
  isSubmitting?: boolean;
  apiError?: string | null;
}

/**
 * Strict format: 09XX-XXX-XXXX
 * Example: 0912-345-6789
 */
const PHONE_FORMAT_REGEX = /^09\d{2}-\d{3}-\d{4}$/;
const GRADE_OPTIONS = ["1", "2", "3", "4", "5", "6"];
const FIXED_SUBJECTS = ["English", "Filipino", "Math"];
const COORDINATOR_SUBJECT_OPTIONS = ["English", "Filipino", "Math"];

export default function AddMasterTeacherModal({
  show,
  onClose,
  onSubmit,
  form,
  isSubmitting = false,
  apiError = null,
}: AddMasterTeacherModalProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting: formSubmitting },
  } = form;

  // Register validation for phone number with local format
  const phoneRegistration = register("phoneNumber", {
    required: "Phone number is required",
    validate: (value) => {
      if (!value) return "Phone number is required";
      const trimmed = value.trim();
      return PHONE_FORMAT_REGEX.test(trimmed)
      ? true
      : "Phone number must follow the format 09XX-XXX-XXXX";
    },
  });

  const formatPhoneValue = (input: string) => {
    // Keep digits only
    const digitsOnly = input.replace(/\D/g, "");

    // Remove leading 0 if duplicated
    let local = digitsOnly;
    if (local.startsWith("09") && local.length > 2) {
      local = "09" + local.slice(2).replace(/^0+/, '');
    } else if (local.startsWith("9") && local.length >= 10) {
      local = "09" + local.slice(1);
    } else {
      local = local.replace(/^0+/, '');
      if (local.length > 0) {
        local = "09" + local;
      }
    }

    // Limit to 11 digits (09 + 9 digits)
    local = local.slice(0, 11);

    // Build formatted string progressively
    let formatted = "";
    if (local.length > 0) {
      formatted = local.slice(0, Math.min(4, local.length));
    }
    if (local.length > 4) {
      formatted += "-" + local.slice(4, Math.min(7, local.length));
    }
    if (local.length > 7) {
      formatted += "-" + local.slice(7, 11);
    }

    return formatted;
  };

  const phoneWatch = watch("phoneNumber") || "";
  const [displayPhone, setDisplayPhone] = useState("");

  useEffect(() => {
    setDisplayPhone(formatPhoneValue(phoneWatch));
  }, [phoneWatch]);

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatPhoneValue(raw);
    setDisplayPhone(formatted);
    setValue("phoneNumber", formatted, { shouldValidate: true, shouldDirty: true });
  };

  const isBusy = useMemo(() => isSubmitting || formSubmitting, [isSubmitting, formSubmitting]);

  const handleClose = () => {
    reset();
    setDisplayPhone("");
    onClose();
  };

  // Set fixed subjects when form is initialized or reset
  const handleFormSubmit = (values: AddMasterTeacherFormValues) => {
    const valuesWithFixedSubjects = {
      ...values,
      subjects: FIXED_SUBJECTS
    };
    onSubmit(valuesWithFixedSubjects);
  };

  const footer = (
    <>
      <DangerButton type="button" onClick={handleClose} disabled={isBusy}>
        Cancel
      </DangerButton>
      <PrimaryButton type="submit" form="add-masterteacher-form" disabled={isBusy}>
        {isBusy ? "Adding…" : "Add Master Teacher"}
      </PrimaryButton>
    </>
  );

  return (
    <BaseModal show={show} onClose={handleClose} title="Add Master Teacher" footer={footer}>
      <form id="add-masterteacher-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {apiError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {apiError}
          </div>
        )}

        <ModalSection title="Personal Details">
          {/* 1st Row: Teacher ID and Role (disabled) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <ModalLabel>Teacher ID</ModalLabel>
              <input
                className="w-full cursor-not-allowed rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500"
                value="Auto-generated"
                disabled
                aria-disabled
              />
            </div>
            <div className="space-y-1">
              <ModalLabel>Role</ModalLabel>
              <input
                className="w-full cursor-not-allowed rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500"
                value="Master Teacher"
                disabled
                aria-disabled
              />
            </div>
          </div>

          {/* Second Row: Name fields */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
            <div className="space-y-1 md:col-span-2">
              <ModalLabel required>First Name</ModalLabel>
              <input
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                placeholder="First name"
                {...register("firstName", {
                  required: "First name is required",
                  minLength: { value: 2, message: "First name must be at least 2 characters" },
                })}
              />
              {errors.firstName && (
                <span className="text-xs text-red-500">{errors.firstName.message as string}</span>
              )}
            </div>
            <div className="space-y-1 md:col-span-2">
              <ModalLabel required>Middle Name</ModalLabel>
              <input
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                placeholder="Middle name"
                {...register("middleName", {
                  required: "Middle name is required",
                  minLength: { value: 2, message: "Middle name must be at least 2 characters" },
                })}
              />
              {errors.middleName && (
                <span className="text-xs text-red-500">{errors.middleName.message as string}</span>
              )}
            </div>
            <div className="space-y-1 md:col-span-2">
              <ModalLabel required>Last Name</ModalLabel>
              <input
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                placeholder="Last name"
                {...register("lastName", {
                  required: "Last name is required",
                  minLength: { value: 2, message: "Last name must be at least 2 characters" },
                })}
              />
              {errors.lastName && (
                <span className="text-xs text-red-500">{errors.lastName.message as string}</span>
              )}
            </div>
            <div className="space-y-1 md:col-span-1">
              <ModalLabel>Suffix</ModalLabel>
              <input
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                placeholder="Jr., Sr., III"
                {...register("suffix")}
              />
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Contact Details">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <ModalLabel required>Email</ModalLabel>
              <input
                type="email"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                placeholder="user@example.com"
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Invalid email format",
                  },
                })}
              />
              {!errors.email ? (
                <p className="text-xs text-gray-500">Please use valid email address</p>
              ) : (
                <span className="text-xs text-red-500">{errors.email.message as string}</span>
              )}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Phone Number</ModalLabel>
              <input
                {...phoneRegistration}
                onChange={(e) => {
                  handlePhoneInput(e);
                  phoneRegistration.onChange?.(e);
                }}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                placeholder="09XX-XXX-XXXX"
                inputMode="numeric"
                maxLength={13} // "09XX-XXX-XXXX" is 13 chars
              />
              {!errors.phoneNumber ? (
                <p className="text-xs text-gray-500">Format: 09XX-XXX-XXXX</p>
              ) : (
                <span className="text-xs text-red-500">{errors.phoneNumber.message as string}</span>
              )}
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Teaching Details">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <ModalLabel required>Grade Handled</ModalLabel>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                {...register("grade", { required: "Grade handled is required" })}
              >
                <option value="" disabled>
                  Select grade
                </option>
                {GRADE_OPTIONS.map((grade) => (
                  <option key={grade} value={grade}>
                    Grade {grade}
                  </option>
                ))}
              </select>
              {errors.grade && (
                <span className="text-xs text-red-500">{errors.grade.message as string}</span>
              )}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Coordinator Subject</ModalLabel>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                {...register("coordinatorSubject", { required: "Coordinator subject is required" })}
              >
                <option value="" disabled>
                  Select subject
                </option>
                {COORDINATOR_SUBJECT_OPTIONS.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
              {errors.coordinatorSubject && (
                <span className="text-xs text-red-500">{errors.coordinatorSubject.message as string}</span>
              )}
            </div>
            <div className="space-y-1">
              <ModalLabel>Remedial Teacher Subjects</ModalLabel>
              <div className="space-y-2 border border-gray-300 rounded-md bg-gray-50 p-3">
                {FIXED_SUBJECTS.map((subject) => (
                  <div key={subject} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={true}
                      readOnly
                      disabled
                      className="rounded border-gray-300 text-blue-600 bg-gray-200"
                    />
                    <span className="text-sm text-gray-700">{subject}</span>
                  </div>
                ))}
                <p className="text-xs text-gray-500 mt-2">All master teachers are assigned these three core subjects</p>
              </div>
            </div>
          </div>
        </ModalSection>
      </form>
    </BaseModal>
  );
}