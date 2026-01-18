import { useEffect, useMemo, useState } from "react";
import BaseModal, { ModalLabel, ModalSection } from "@/components/Common/Modals/BaseModal";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

export const QUARTER_OPTIONS = ["1st Quarter", "2nd Quarter"] as const;
export type QuarterOption = typeof QUARTER_OPTIONS[number];
export type QuarterRange = Record<QuarterOption, { startMonth: number | null; endMonth: number | null }>;

const MONTH_OPTIONS = [
  { label: "January", value: 0 },
  { label: "February", value: 1 },
  { label: "March", value: 2 },
  { label: "April", value: 3 },
  { label: "May", value: 4 },
  { label: "June", value: 5 },
  { label: "July", value: 6 },
  { label: "August", value: 7 },
  { label: "September", value: 8 },
  { label: "October", value: 9 },
  { label: "November", value: 10 },
  { label: "December", value: 11 },
] as const;

export interface RemedialPeriodFormValues {
  schoolYear: string;
  quarters: QuarterRange;
}

interface RemedialPeriodModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (values: RemedialPeriodFormValues) => void;
  initialData?: RemedialPeriodFormValues | null;
}
const resolveDefaultSchoolYear = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  return month >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

export default function RemedialPeriodModal({ show, onClose, onSave, initialData }: RemedialPeriodModalProps) {
  const [schoolYear, setSchoolYear] = useState<string>(resolveDefaultSchoolYear());
  const [quarterRanges, setQuarterRanges] = useState<QuarterRange>(() => ({
    "1st Quarter": { startMonth: null, endMonth: null },
    "2nd Quarter": { startMonth: null, endMonth: null },
  }));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!show) return;
    setSchoolYear(initialData?.schoolYear ?? resolveDefaultSchoolYear());
    setQuarterRanges({
      "1st Quarter": {
        startMonth: initialData?.quarters?.["1st Quarter"]?.startMonth ?? null,
        endMonth: initialData?.quarters?.["1st Quarter"]?.endMonth ?? null,
      },
      "2nd Quarter": {
        startMonth: initialData?.quarters?.["2nd Quarter"]?.startMonth ?? null,
        endMonth: initialData?.quarters?.["2nd Quarter"]?.endMonth ?? null,
      },
    });
    setError(null);
  }, [show, initialData]);

  const updateRange = (quarter: QuarterOption, field: "startMonth" | "endMonth", value: number | null) => {
    setError(null);
    setQuarterRanges((prev) => ({
      ...prev,
      [quarter]: {
        ...prev[quarter],
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    for (const quarter of QUARTER_OPTIONS) {
      const range = quarterRanges[quarter];
      if (!range.startMonth || !range.endMonth) {
        setError(`Select start and end months for the ${quarter}.`);
        return;
      }
      if (range.startMonth > range.endMonth) {
        setError(`The ${quarter} start month must be before the end month.`);
        return;
      }
    }

    onSave({
      schoolYear: schoolYear.trim(),
      quarters: quarterRanges,
    });
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
      <ModalSection title="School Year">
        <div className="space-y-2">
          <ModalLabel required>School Year</ModalLabel>
          <input
            value={schoolYear}
            onChange={(event) => {
              setSchoolYear(event.target.value);
              setError(null);
            }}
            placeholder="2025-2026"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#013300]"
          />
          <p className="text-xs text-gray-500">Format: YYYY-YYYY (ex. 2025-2026).</p>
        </div>
      </ModalSection>

      <ModalSection title="Quarter Month Ranges">
        <div className="space-y-5">
          {QUARTER_OPTIONS.map((quarter) => (
            <div key={quarter} className="space-y-2">
              <ModalLabel>{quarter}</ModalLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Start Month</label>
                  <select
                    value={quarterRanges[quarter]?.startMonth ?? ""}
                    onChange={(event) =>
                      updateRange(quarter, "startMonth", event.target.value ? Number(event.target.value) : null)
                    }
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#013300]"
                  >
                    <option value="">Select start month</option>
                    {MONTH_OPTIONS.map(({ label, value }) => (
                      <option key={`${quarter}-start-${label}`} value={value + 1}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">End Month</label>
                  <select
                    value={quarterRanges[quarter]?.endMonth ?? ""}
                    onChange={(event) =>
                      updateRange(quarter, "endMonth", event.target.value ? Number(event.target.value) : null)
                    }
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#013300]"
                  >
                    <option value="">Select end month</option>
                    {MONTH_OPTIONS.map(({ label, value }) => (
                      <option key={`${quarter}-end-${label}`} value={value + 1}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </ModalSection>
    </BaseModal>
  );
}
