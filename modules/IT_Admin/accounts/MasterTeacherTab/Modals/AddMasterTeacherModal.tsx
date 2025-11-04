"use client";

import { useCallback, useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import BaseModal, { ModalSection, ModalLabel } from "@/components/Common/Modals/BaseModal";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";

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
  // Subjects are always fixed
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

const PHONE_FORMAT_REGEX = /^\+63-9\d{2}-\d{3}-\d{4}$/;
const GRADE_OPTIONS = ["1", "2", "3", "4", "5", "6"];
const FIXED_SUBJECTS = ["English", "Filipino", "Math"];

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
    reset,
    setValue,
    formState: { errors, isSubmitting: formSubmitting },
  } = form;

  const phoneRegistration = register("phoneNumber", {
    required: "Contact number is required",
    validate: (value) => {
      if (!value) return "Contact number is required";
      const trimmed = value.trim();
      return PHONE_FORMAT_REGEX.test(trimmed)
        ? true
        : "Contact number must follow the format +63-9XX-XXX-XXXX";
    },
  });

  const formatPhoneValue = useCallback((input: string) => {
    const digitsOnly = input.replace(/\D/g, "");

    let local = digitsOnly;
    if (local.startsWith("63")) {
      local = local.slice(2);
    } else if (local.startsWith("0")) {
      local = local.slice(1);
    }

    local = local.slice(0, 10);

    let formatted = "+63";
    if (local.length > 0) {
      formatted += "-" + local.slice(0, Math.min(3, local.length));
    }
    if (local.length > 3) {
      formatted += "-" + local.slice(3, Math.min(6, local.length));
    }
    if (local.length > 6) {
      formatted += "-" + local.slice(6, 10);
    }

    return formatted;
  }, []);

  const handlePhoneInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatPhoneValue(event.target.value);
      setValue("phoneNumber", formatted, { shouldValidate: true, shouldDirty: true });
    },
    [formatPhoneValue, setValue],
  );

  const isBusy = useMemo(() => isSubmitting || formSubmitting, [isSubmitting, formSubmitting]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  // Set fixed subjects when form is initialized or reset
  const handleFormSubmit = useCallback((values: AddMasterTeacherFormValues) => {
    const valuesWithFixedSubjects = {
      ...values,
      subjects: FIXED_SUBJECTS
    };
    onSubmit(valuesWithFixedSubjects);
  }, [onSubmit]);

  const footer = (
    <>
      <DangerButton type="button" onClick={handleClose} disabled={isBusy}>
        Cancel
      </DangerButton>
      <PrimaryButton type="submit" form="add-masterteacher-form" disabled={isBusy}>
        {isBusy ? "Saving…" : "Save Master Teacher"}
      </PrimaryButton>
    </>
  );

  return (
    <BaseModal show={show} onClose={handleClose} title="Add New Master Teacher" footer={footer}>
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
                onChange={(event) => {
                  handlePhoneInput(event);
                  phoneRegistration.onChange?.(event);
                }}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                placeholder="+63-9XX-XXX-XXXX"
                inputMode="numeric"
                maxLength={16}
              />
              {!errors.phoneNumber ? (
                <p className="text-xs text-gray-500">Format: +63-9XX-XXX-XXXX</p>
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
              <ModalLabel>Subjects Handled</ModalLabel>
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