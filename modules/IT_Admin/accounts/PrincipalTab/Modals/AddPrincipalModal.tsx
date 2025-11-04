"use client";

import { useMemo, useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import BaseModal, { ModalLabel, ModalSection } from "@/components/Common/Modals/BaseModal";

export interface AddPrincipalFormValues {
  itAdminId: string;
  role: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  email: string;
  phoneNumber: string;
}

interface AddPrincipalModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (values: AddPrincipalFormValues) => void | Promise<void>;
  form: UseFormReturn<AddPrincipalFormValues>;
  isSubmitting?: boolean;
  apiError?: string | null;
}

/**
 * Strict format: +63-9XX-XXX-XXXX
 * Example: +63-912-345-6789
 */
const PHONE_FORMAT_REGEX = /^\+63-9\d{2}-\d{3}-\d{4}$/;

export default function AddPrincipalModal({
  show,
  onClose,
  onSubmit,
  form,
  isSubmitting = false,
  apiError = null,
}: AddPrincipalModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting: formSubmitting },
  } = form;

  // Register validation (keeps react-hook-form validation)
  const phoneRegistration = register("phoneNumber", {
    required: "Phone number is required",
    validate: (value) => {
      if (!value) return "Phone number is required";
      const trimmed = value.trim();
      return PHONE_FORMAT_REGEX.test(trimmed)
      ? true
      : "Phone number must follow the format +63-9XX-XXX-XXXX";
    },
  });

  const formatPhoneValue = useCallback((input: string) => {
    // Keep digits only
    const digitsOnly = input.replace(/\D/g, "");

    // Normalize: drop leading 0 or 63 if present to obtain 10-digit local number
    let local = digitsOnly;
    if (local.startsWith("63")) {
      local = local.slice(2);
    } else if (local.startsWith("0")) {
      local = local.slice(1);
    }

    // Limit to 10 digits (mobile local number)
    local = local.slice(0, 10);

    // Build formatted string progressively (so user sees dashes inserted)
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
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const formatted = formatPhoneValue(raw);
      // Update react-hook-form value - mark as dirty/validate
      setValue("phoneNumber", formatted, { shouldValidate: true, shouldDirty: true });
    },
    [formatPhoneValue, setValue],
  );

  const isBusy = useMemo(() => isSubmitting || formSubmitting, [isSubmitting, formSubmitting]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const footer = (
    <>
      <DangerButton type="button" onClick={handleClose} disabled={isBusy}>
        Cancel
      </DangerButton>
      <PrimaryButton type="submit" form="add-principal-form" disabled={isBusy}>
        {isBusy ? "Adding…" : "Add Principal"}
      </PrimaryButton>
    </>
  );

  return (
    <BaseModal show={show} onClose={handleClose} title="Add Principal" footer={footer}>
      <form id="add-principal-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {apiError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {apiError}
          </div>
        )}
        
        <ModalSection title="Personal Details">
          {/* 1st Row: IT Admin ID and Role (disabled) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <ModalLabel>IT Admin ID</ModalLabel>
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
                value="Principal"
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
      </form>
    </BaseModal>
  );
}