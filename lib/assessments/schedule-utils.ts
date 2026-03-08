type QuizDraftSection = {
  id: string;
  title: string;
  description: string;
};

type QuizDraftData = {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  phonemicLevel: string;
  students: [];
  questions: [];
  sections: QuizDraftSection[];
  isPublished: boolean;
};

export const DEFAULT_ASSESSMENT_START_HOUR = 8;
export const DEFAULT_ASSESSMENT_END_HOUR = 9;
export const MAX_ASSESSMENT_SPAN_DAYS = 6;

const pad = (value: number) => value.toString().padStart(2, "0");

const createId = () => `section-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;

const toLocalIsoMinute = (date: Date): string => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const getFixedAssessmentStart = (value: string | Date | null | undefined): Date => {
  const parsed = value instanceof Date ? new Date(value) : value ? new Date(value) : new Date();
  const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const next = new Date(base);
  next.setSeconds(0, 0);
  next.setHours(DEFAULT_ASSESSMENT_START_HOUR, 0, 0, 0);
  return next;
};

export const getMaxAssessmentEnd = (start: string | Date | null | undefined): Date => {
  const base = getFixedAssessmentStart(start);
  const max = new Date(base);
  max.setDate(max.getDate() + MAX_ASSESSMENT_SPAN_DAYS);
  max.setHours(23, 59, 0, 0);
  return max;
};

export const isFixedAssessmentStartTime = (value: string | Date | null | undefined): boolean => {
  const parsed = value instanceof Date ? new Date(value) : value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getTime() === getFixedAssessmentStart(parsed).getTime();
};

export const isAssessmentRangeWithinLimit = (
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): boolean => {
  const startDate = getFixedAssessmentStart(start);
  const endDate = end instanceof Date ? new Date(end) : end ? new Date(end) : null;
  if (!endDate || Number.isNaN(endDate.getTime())) {
    return false;
  }

  return endDate.getTime() > startDate.getTime() && endDate.getTime() <= getMaxAssessmentEnd(startDate).getTime();
};

const buildDateWithTime = (date: Date, fallbackHour: number): Date => {
  const next = new Date(date);
  next.setSeconds(0, 0);
  next.setHours(fallbackHour, 0, 0, 0);
  return next;
};

const applyTimeToDate = (date: Date, value: string | null | undefined): Date | null => {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  const next = new Date(date);
  next.setSeconds(0, 0);
  next.setHours(hours, minutes, 0, 0);
  return next;
};

export const toScheduleDateKey = (value: string | Date | null | undefined): string | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
};

export const buildQuizDraftFromSchedule = (
  subject: string,
  level: string,
  date: Date,
  startTime?: string | null,
  endTime?: string | null,
): QuizDraftData => {
  const startDate = getFixedAssessmentStart(date);
  const endDate = applyTimeToDate(date, endTime) ?? buildDateWithTime(date, DEFAULT_ASSESSMENT_END_HOUR);
  if (endDate.getTime() <= startDate.getTime()) {
    endDate.setHours(startDate.getHours() + 1, startDate.getMinutes(), 0, 0);
  }

  return {
    title: `${subject} Assessment`,
    description: "",
    startDate: toLocalIsoMinute(startDate),
    endDate: toLocalIsoMinute(endDate),
    phonemicLevel: level,
    students: [],
    questions: [],
    sections: [
      {
        id: createId(),
        title: "Section 1",
        description: "",
      },
    ],
    isPublished: false,
  };
};
