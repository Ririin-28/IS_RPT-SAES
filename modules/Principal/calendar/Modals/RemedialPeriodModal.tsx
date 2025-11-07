import { useEffect, useMemo, useState } from "react";
import BaseModal, { ModalLabel, ModalSection } from "@/components/Common/Modals/BaseModal";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

export const QUARTER_OPTIONS = ["1st Quarter", "2nd Quarter"] as const;
export type QuarterOption = typeof QUARTER_OPTIONS[number];
export type QuarterMonths = Record<QuarterOption, number[]>;

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
  quarter: QuarterOption | "";
  startDate: string;
  endDate: string;
  months: QuarterMonths;
}

interface RemedialPeriodModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (values: RemedialPeriodFormValues) => void;
  initialData?: RemedialPeriodFormValues | null;
  availableQuarters?: readonly QuarterOption[];
}

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function RemedialPeriodModal({ show, onClose, onSave, initialData, availableQuarters }: RemedialPeriodModalProps) {
  const allowedQuarters = useMemo<QuarterOption[]>(
    () => (availableQuarters?.length ? [...availableQuarters] : [...QUARTER_OPTIONS]),
    [availableQuarters],
  );
  const [quarter, setQuarter] = useState<QuarterOption | "">("");
  const [quarterMonths, setQuarterMonths] = useState<QuarterMonths>(() => ({
    "1st Quarter": [],
    "2nd Quarter": [],
  }));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!show) return;
    const initialQuarter = initialData?.quarter ?? "";
    const presetQuarter = allowedQuarters.includes(initialQuarter as QuarterOption)
      ? initialQuarter
      : allowedQuarters[0] ?? "";
    setQuarter(presetQuarter ?? "");
    const seeds = initialData?.months ?? {
      "1st Quarter": [],
      "2nd Quarter": [],
    };
    setQuarterMonths({
      "1st Quarter": [...(seeds["1st Quarter"] ?? [])],
      "2nd Quarter": [...(seeds["2nd Quarter"] ?? [])],
    });
    setError(null);
  }, [show, initialData, allowedQuarters]);

  const toggleMonth = (targetQuarter: QuarterOption, monthIndex: number) => {
    setError(null);
    setQuarterMonths((prev) => {
      const existing = prev[targetQuarter] ?? [];
      const next = existing.includes(monthIndex)
        ? existing.filter((value) => value !== monthIndex)
        : [...existing, monthIndex].sort((a, b) => a - b);
      return {
        ...prev,
        [targetQuarter]: next,
      } satisfies QuarterMonths;
    });
  };

  const renderMonthSelection = (targetQuarter: QuarterOption) => {
    const selectedMonths = quarterMonths[targetQuarter] ?? [];
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {MONTH_OPTIONS.map(({ label, value }) => {
          const isSelected = selectedMonths.includes(value);
          return (
            <button
              key={`${targetQuarter}-${label}`}
              type="button"
              onClick={() => toggleMonth(targetQuarter, value)}
              aria-pressed={isSelected}
              className={`rounded-md border px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#013300]
                ${isSelected ? "border-[#013300] bg-[#013300]/10 text-[#013300]" : "border-gray-300 bg-white text-gray-700 hover:border-[#013300]"}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  };

  const handleSave = () => {
    if (!quarter) {
      setError("Select the quarter you want to activate.");
      return;
    }

    const selectedMonths = quarterMonths[quarter];
    if (!selectedMonths || selectedMonths.length === 0) {
      setError(`Select at least one month for the ${quarter}.`);
      return;
    }

    const sortedMonths = [...selectedMonths].sort((a, b) => a - b);
    const referenceYear = (() => {
      if (initialData?.quarter === quarter) {
        const parsed = new Date(initialData.startDate);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed.getFullYear();
        }
      }
      return new Date().getFullYear();
    })();
    const start = new Date(referenceYear, sortedMonths[0], 1);
    const end = new Date(referenceYear, sortedMonths[sortedMonths.length - 1] + 1, 0);

    const monthsPayload: QuarterMonths = {
      "1st Quarter": [...(quarterMonths["1st Quarter"] ?? [])],
      "2nd Quarter": [...(quarterMonths["2nd Quarter"] ?? [])],
    };

    if (allowedQuarters.length === 1 && allowedQuarters[0] === quarter) {
      for (const option of QUARTER_OPTIONS) {
        if (option !== quarter) {
          monthsPayload[option] = [];
        }
      }
    }

    onSave({
      quarter,
      startDate: toIsoDate(start),
      endDate: toIsoDate(end),
      months: monthsPayload,
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
      <ModalSection title="Activate Quarter">
        <div className="space-y-2">
          <ModalLabel required>Quarter</ModalLabel>
          <select
            value={quarter}
            onChange={(event) => {
              setQuarter(event.target.value as QuarterOption | "");
              setError(null);
            }}
            disabled={allowedQuarters.length <= 1}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#013300] disabled:bg-gray-100 disabled:text-gray-500"
          >
            {allowedQuarters.length > 1 && (
              <option value="" disabled>
                Select quarter to activate
              </option>
            )}
            {allowedQuarters.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            {allowedQuarters.length > 1
              ? "Choose which quarter you want to open for remedial scheduling, then select the months covered by each quarter below."
              : "The active quarter is locked. Update the selected months below or cancel the schedule to switch quarters once the period ends."}
          </p>
        </div>
      </ModalSection>

      <ModalSection title="Quarter Month Coverage">
        {quarter ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <ModalLabel>{quarter}</ModalLabel>
              <span className="text-xs text-gray-500">
                {quarterMonths[quarter]?.length || 0} month{(quarterMonths[quarter]?.length ?? 0) === 1 ? "" : "s"} selected
              </span>
            </div>
            {renderMonthSelection(quarter)}
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            Choose a quarter above to unlock the month selector.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </ModalSection>
    </BaseModal>
  );
}
