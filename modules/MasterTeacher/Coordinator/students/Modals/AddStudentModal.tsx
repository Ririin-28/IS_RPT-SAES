"use client";

import BaseModal, { ModalLabel, ModalSection } from "@/components/Common/Modals/BaseModal";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import { useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

export interface AddStudentFormValues {
  studentId: string;
  role: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  grade: string;
  section: string;
  guardianFirstName: string;
  guardianMiddleName: string;
  guardianLastName: string;
  guardianSuffix: string;
  relationship: string;
  guardianContact: string;
  address: string;
  englishPhonemic: string;
  filipinoPhonemic: string;
  mathPhonemic: string;
}

interface AddStudentModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (values: AddStudentFormValues) => void | Promise<void>;
  form: UseFormReturn<AddStudentFormValues>;
  isSubmitting?: boolean;
  apiError?: string | null;
  subjectLabel: string;
  gradeLabel?: string | null;
}

/**
 * Strict format: 09XX-XXX-XXXX
 * Example: 0912-345-6789
 */
const PHONE_FORMAT_REGEX = /^09\d{2}-\d{3}-\d{4}$/;
const GRADE_OPTIONS = ["1", "2", "3", "4", "5", "6"];
const SECTION_OPTIONS = ["A", "B", "C", "D", "E", "F"];
const RELATIONSHIP_OPTIONS = ["Mother", "Father", "Grandmother", "Grandfather", "Aunt", "Uncle", "Guardian", "Other"];
const ASSESSMENT_LEVELS = [
  "Exempt",
  "Non-Reader",
  "Syllable", 
  "Word",
  "Sentence",
  "Paragraph",
  "Finished"
];

export default function AddStudentModal({
  show,
  onClose,
  onSubmit,
  form,
  isSubmitting = false,
  apiError = null,
  subjectLabel,
  gradeLabel = null,
}: AddStudentModalProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting: formSubmitting },
  } = form;

  // Register validation for phone number with local format
  const phoneRegistration = register("guardianContact", {
    required: "Contact number is required",
    validate: (value) => {
      if (!value) return "Contact number is required";
      const trimmed = value.trim();
      return PHONE_FORMAT_REGEX.test(trimmed)
      ? true
      : "Contact number must follow the format 09XX-XXX-XXXX";
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

  const phoneWatch = watch("guardianContact") || "";
  const [displayPhone, setDisplayPhone] = useState("");

  useEffect(() => {
    setDisplayPhone(formatPhoneValue(phoneWatch));
  }, [phoneWatch]);

  useEffect(() => {
    if (gradeLabel && gradeLabel.trim().length > 0) {
      setValue("grade", gradeLabel.trim(), { shouldDirty: false, shouldTouch: false, shouldValidate: false });
    }
  }, [gradeLabel, setValue]);

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatPhoneValue(raw);
    setDisplayPhone(formatted);
    setValue("guardianContact", formatted, { shouldValidate: true, shouldDirty: true });
  };

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
      <PrimaryButton type="submit" form="add-student-form" disabled={isBusy}>
        {isBusy ? "Adding…" : "Add Student"}
      </PrimaryButton>
    </>
  );

  return (
    <BaseModal show={show} onClose={handleClose} title="Add Student" footer={footer}>
      <form id="add-student-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {apiError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {apiError}
          </div>
        )}
        
        <ModalSection title="Personal Details">
          {/* 1st Row: Student ID and Role (disabled) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <ModalLabel>Student ID</ModalLabel>
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
                value="Student"
                disabled
                aria-disabled
              />
            </div>
          </div>

          {/* Second Row: Student Name fields */}
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

        <ModalSection title="Academic Details">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <ModalLabel required>Grade Level</ModalLabel>
              {gradeLabel && gradeLabel.trim().length > 0 ? (
                <>
                  <input
                    className="w-full cursor-not-allowed rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-600"
                    value={gradeLabel.trim()}
                    disabled
                    aria-disabled
                  />
                  <input
                    type="hidden"
                    defaultValue={gradeLabel.trim()}
                    readOnly
                    {...register("grade", { required: "Grade level is required" })}
                  />
                </>
              ) : (
                <select
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                  {...register("grade", { required: "Grade level is required" })}
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
              )}
              {errors.grade && (
                <span className="text-xs text-red-500">{errors.grade.message as string}</span>
              )}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Section</ModalLabel>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                {...register("section", { required: "Section is required" })}
              >
                <option value="" disabled>
                  Select section
                </option>
                {SECTION_OPTIONS.map((section) => (
                  <option key={section} value={section}>
                    Section {section}
                  </option>
                ))}
              </select>
              {errors.section && (
                <span className="text-xs text-red-500">{errors.section.message as string}</span>
              )}
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Guardian Details">
          {/* 1st Row: Guardian Name fields */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
            <div className="space-y-1 md:col-span-2">
              <ModalLabel required>First Name</ModalLabel>
              <input
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                placeholder="First name"
                {...register("guardianFirstName", {
                  required: "Guardian first name is required",
                  minLength: { value: 2, message: "Guardian first name must be at least 2 characters" },
                })}
              />
              {errors.guardianFirstName && (
                <span className="text-xs text-red-500">{errors.guardianFirstName.message as string}</span>
              )}
            </div>
            <div className="space-y-1 md:col-span-2">
              <ModalLabel required>Middle Name</ModalLabel>
              <input
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                placeholder="Middle name"
                {...register("guardianMiddleName", {
                  required: "Guardian middle name is required",
                  minLength: { value: 2, message: "Guardian middle name must be at least 2 characters" },
                })}
              />
              {errors.guardianMiddleName && (
                <span className="text-xs text-red-500">{errors.guardianMiddleName.message as string}</span>
              )}
            </div>
            <div className="space-y-1 md:col-span-2">
              <ModalLabel required>Last Name</ModalLabel>
              <input
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                placeholder="Last name"
                {...register("guardianLastName", {
                  required: "Guardian last name is required",
                  minLength: { value: 2, message: "Guardian last name must be at least 2 characters" },
                })}
              />
              {errors.guardianLastName && (
                <span className="text-xs text-red-500">{errors.guardianLastName.message as string}</span>
              )}
            </div>
            <div className="space-y-1 md:col-span-1">
              <ModalLabel>Suffix</ModalLabel>
              <input
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                placeholder="Jr., Sr., III"
                {...register("guardianSuffix")}
              />
            </div>
          </div>

          {/* 2nd Row: Relationship and Contact */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <ModalLabel required>Relationship</ModalLabel>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                {...register("relationship", { required: "Relationship is required" })}
              >
                <option value="" disabled>
                  Select relationship
                </option>
                {RELATIONSHIP_OPTIONS.map((relationship) => (
                  <option key={relationship} value={relationship}>
                    {relationship}
                  </option>
                ))}
              </select>
              {errors.relationship && (
                <span className="text-xs text-red-500">{errors.relationship.message as string}</span>
              )}
            </div>
            <div className="space-y-1">
              <ModalLabel required>Contact Number</ModalLabel>
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
              {!errors.guardianContact ? (
                <p className="text-xs text-gray-500">Format: 09XX-XXX-XXXX</p>
              ) : (
                <span className="text-xs text-red-500">{errors.guardianContact.message as string}</span>
              )}
            </div>
          </div>

          {/* 3rd Row: Address */}
          <div className="space-y-1">
            <ModalLabel required>Address</ModalLabel>
            <input
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
              placeholder="Street Name, Barangay, City, Region"
              {...register("address", {
                required: "Address is required",
                minLength: { value: 5, message: "Address must be at least 5 characters" },
              })}
            />
            {!errors.address ? (
              <p className="text-xs text-gray-500">Format: Street Name, Barangay, City, Region</p>
            ) : (
              <span className="text-xs text-red-500">{errors.address.message as string}</span>
            )}
          </div>
        </ModalSection>

        <ModalSection title="Assessment Level">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <ModalLabel>Subject Assigned</ModalLabel>
              <input
                className="w-full cursor-not-allowed rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500"
                value={subjectLabel}
                disabled
                aria-disabled
              />
            </div>
            <div className="space-y-1">
              <ModalLabel required>Phonemic</ModalLabel>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black"
                {...register("englishPhonemic", { required: "Phonemic level is required" })}
              >
                <option value="" disabled>
                  Select level
                </option>
                {ASSESSMENT_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              {errors.englishPhonemic && (
                <span className="text-xs text-red-500">{errors.englishPhonemic.message as string}</span>
              )}
            </div>
          </div>
        </ModalSection>
      </form>
    </BaseModal>
  );
}