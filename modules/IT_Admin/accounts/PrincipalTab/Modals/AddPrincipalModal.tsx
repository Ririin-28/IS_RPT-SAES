"use client";

import { useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import BaseModal, { ModalLabel, ModalSection } from "@/components/Common/Modals/BaseModal";

export interface AddPrincipalFormValues {
  firstName: string;
  middleName: string;
  lastName: string;
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

function formatPhoneOnInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 4) {
    return digits;
  }
  if (digits.length <= 7) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
}

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
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting: formSubmitting },
  } = form;

  const {
    ref: phoneRef,
    onBlur: phoneBlur,
    name: phoneName,
  } = register("phoneNumber", {
    required: "Phone number is required",
    validate: (value) => {
      if (!value) {
        return "Phone number is required";
      }
      return /^\d{10,11}$/.test(value)
        ? true
        : "Phone number must contain 10 to 11 digits";
    },
  });

  const phoneWatch = watch("phoneNumber") || "";
  const [displayPhone, setDisplayPhone] = useState("");

  useEffect(() => {
    setDisplayPhone(formatPhoneOnInput(phoneWatch));
  }, [phoneWatch]);

  const isBusy = useMemo(() => isSubmitting || formSubmitting, [isSubmitting, formSubmitting]);

  const handleClose = () => {
    reset();
    setDisplayPhone("");
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
        <ModalSection title="Personal Information">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1">
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
            <div className="space-y-1">
              <ModalLabel>Middle Name</ModalLabel>
              <input
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                placeholder="Middle name"
                {...register("middleName")}
              />
            </div>
            <div className="space-y-1">
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
              {errors.email && (
                <span className="text-xs text-red-500">{errors.email.message as string}</span>
              )}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Phone Number</ModalLabel>
              <input
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                placeholder="0912-345-6789"
                name={phoneName}
                ref={phoneRef}
                value={displayPhone}
                onChange={(event) => {
                  const digitsOnly = event.target.value.replace(/\D/g, "");
                  setDisplayPhone(formatPhoneOnInput(digitsOnly));
                  setValue("phoneNumber", digitsOnly, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                }}
                onBlur={(event) => {
                  const digitsOnly = event.target.value.replace(/\D/g, "");
                  setValue("phoneNumber", digitsOnly, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  setDisplayPhone(formatPhoneOnInput(digitsOnly));
                  phoneBlur(event);
                }}
              />
              {errors.phoneNumber && (
                <span className="text-xs text-red-500">{errors.phoneNumber.message as string}</span>
              )}
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Account">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <ModalLabel required>Role</ModalLabel>
              <input
                className="w-full cursor-not-allowed rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-black"
                value="Principal"
                readOnly
                aria-readonly
              />
              <p className="text-xs text-gray-500">Role is fixed for this form. Principal ID is generated automatically.</p>
            </div>
          </div>
        </ModalSection>
      </form>
    </BaseModal>
  );
}