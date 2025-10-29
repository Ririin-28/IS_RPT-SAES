import { useEffect, useMemo, useRef, useState } from "react";
import BaseModal, { ModalLabel, ModalSection } from "@/components/Common/Modals/BaseModal";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import Flatpickr from "react-flatpickr";
import type { Instance as FlatpickrInstance } from "flatpickr/dist/types/instance";

const QUARTER_OPTIONS = ["1st Quarter", "2nd Quarter"] as const;

export interface RemedialPeriodFormValues {
  quarter: typeof QUARTER_OPTIONS[number] | "";
  startDate: string;
  endDate: string;
}

interface RemedialPeriodModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (values: RemedialPeriodFormValues) => void;
  initialData?: RemedialPeriodFormValues | null;
}

const formatDateForDisplay = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const parseInputDate = (value?: string) => {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
};

const formatInputValue = (value?: string) => {
  if (!value) return "";
  const parsed = parseInputDate(value);
  return parsed ? formatDateForDisplay(parsed) : value;
};

const formatFromPicker = (selectedDates: Date[], dateStr: string) => {
  if (selectedDates[0]) {
    return formatDateForDisplay(selectedDates[0]);
  }
  return dateStr;
};
const DATE_INPUT_CLASSES = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#013300]";

export default function RemedialPeriodModal({ show, onClose, onSave, initialData }: RemedialPeriodModalProps) {
  const [formValues, setFormValues] = useState<RemedialPeriodFormValues>({
    quarter: "",
    startDate: "",
    endDate: "",
  });
  const [error, setError] = useState<string | null>(null);
  const startPickerRef = useRef<FlatpickrInstance | null>(null);
  const endPickerRef = useRef<FlatpickrInstance | null>(null);

  const startDateOptions = useMemo(() => {
    const maxDate = parseInputDate(formValues.endDate);
    return {
      dateFormat: "M j, Y",
      allowInput: true,
      disableMobile: true,
      ...(maxDate ? { maxDate } : {}),
    } as const;
  }, [formValues.endDate]);

  const endDateOptions = useMemo(() => {
    const minDate = parseInputDate(formValues.startDate);
    return {
      dateFormat: "M j, Y",
      allowInput: true,
      disableMobile: true,
      ...(minDate ? { minDate } : {}),
    } as const;
  }, [formValues.startDate]);

  useEffect(() => {
    if (!show) return;
    setFormValues({
      quarter: initialData?.quarter ?? "",
      startDate: formatInputValue(initialData?.startDate),
      endDate: formatInputValue(initialData?.endDate),
    });
    setError(null);
  }, [show, initialData]);

  const handleChange = (field: keyof RemedialPeriodFormValues, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  useEffect(() => {
    if (!startPickerRef.current) return;
    const parsedEnd = parseInputDate(formValues.endDate);
    startPickerRef.current.set("maxDate", parsedEnd ?? null);
  }, [formValues.endDate]);

  useEffect(() => {
    if (!endPickerRef.current) return;
    const parsedStart = parseInputDate(formValues.startDate);
    endPickerRef.current.set("minDate", parsedStart ?? null);
  }, [formValues.startDate]);

  const handleSave = () => {
    const { quarter, startDate, endDate } = formValues;
    if (!quarter || !startDate || !endDate) {
      setError("All fields are required.");
      return;
    }

    const start = parseInputDate(startDate);
    const end = parseInputDate(endDate);
    if (!start || !end) {
      setError("Please choose valid dates.");
      return;
    }

    if (end < start) {
      setError("End date must be on or after the start date.");
      return;
    }

    onSave({ quarter, startDate, endDate });
  };

  return (
    <BaseModal
      show={show}
      onClose={onClose}
      title="Set Remedial Period"
      maxWidth="lg"
      footer={(
        <>
          <SecondaryButton type="button" onClick={onClose} className="px-5 py-2.5">
            Cancel
          </SecondaryButton>
          <PrimaryButton type="button" onClick={handleSave} className="px-5 py-2.5">
            Save Period
          </PrimaryButton>
        </>
      )}
    >
      <ModalSection title="Remedial Quarter">
        <div className="space-y-2">
          <ModalLabel required>Quarter</ModalLabel>
          <select
            value={formValues.quarter}
            onChange={(event) => handleChange("quarter", event.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#013300]"
          >
            <option value="" disabled>
              Select quarter
            </option>
            {QUARTER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </ModalSection>

      <ModalSection title="Remedial Period Schedule">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <ModalLabel required>Start Date</ModalLabel>
            <Flatpickr
              value={formValues.startDate}
              options={startDateOptions}
              onReady={(_, __, instance) => {
                startPickerRef.current = instance;
              }}
              onChange={(selectedDates, dateStr) => {
                handleChange("startDate", formatFromPicker(selectedDates, dateStr));
              }}
              onValueUpdate={(selectedDates, dateStr) => {
                handleChange("startDate", formatFromPicker(selectedDates, dateStr));
              }}
              className={DATE_INPUT_CLASSES}
              placeholder="Select start date"
            />
          </div>
          <div className="space-y-2">
            <ModalLabel required>End Date</ModalLabel>
            <Flatpickr
              value={formValues.endDate}
              options={endDateOptions}
              onReady={(_, __, instance) => {
                endPickerRef.current = instance;
              }}
              onChange={(selectedDates, dateStr) => {
                handleChange("endDate", formatFromPicker(selectedDates, dateStr));
              }}
              onValueUpdate={(selectedDates, dateStr) => {
                handleChange("endDate", formatFromPicker(selectedDates, dateStr));
              }}
              className={DATE_INPUT_CLASSES}
              placeholder="Select end date"
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </ModalSection>
    </BaseModal>
  );
}
