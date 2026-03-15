const SCHOOL_TIME_ZONE = "Asia/Manila";

type SupportedDateValue = Date | string | null | undefined;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: SCHOOL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function getDateParts(value: SupportedDateValue): { year: number; month: number; day: number } | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const directMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (directMatch) {
      return {
        year: Number.parseInt(directMatch[1], 10),
        month: Number.parseInt(directMatch[2], 10),
        day: Number.parseInt(directMatch[3], 10),
      };
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return getDateParts(parsed);
    }

    return null;
  }

  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return null;
  }

  const parts = DATE_FORMATTER.formatToParts(value);
  const year = Number.parseInt(parts.find((part) => part.type === "year")?.value ?? "", 10);
  const month = Number.parseInt(parts.find((part) => part.type === "month")?.value ?? "", 10);
  const day = Number.parseInt(parts.find((part) => part.type === "day")?.value ?? "", 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return { year, month, day };
}

export function getScheduleDateKey(value: SupportedDateValue): string | null {
  const parts = getDateParts(value);
  if (!parts) {
    return null;
  }
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function getSchoolTodayDateKey(now: Date = new Date()): string {
  return getScheduleDateKey(now) ?? "0000-00-00";
}

export function isScheduleInFuture(value: SupportedDateValue, now: Date = new Date()): boolean {
  const scheduleKey = getScheduleDateKey(value);
  if (!scheduleKey) {
    return false;
  }
  return scheduleKey > getSchoolTodayDateKey(now);
}

export function formatScheduleDateLabel(value: SupportedDateValue): string | null {
  const parts = getDateParts(value);
  if (!parts) {
    return null;
  }
  return `${MONTH_NAMES[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

export function buildFutureScheduleMessage(value: SupportedDateValue): string {
  const label = formatScheduleDateLabel(value);
  if (label) {
    return `This remedial session is scheduled for ${label} and can only be started on or after that date.`;
  }
  return "This remedial session can only be started on its scheduled date or later.";
}
