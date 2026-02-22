export const SUBJECT_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
export type SubjectWeekday = typeof SUBJECT_WEEKDAYS[number];
export type SubjectScheduleFormValues = Record<SubjectWeekday, string> & {
  startTime: string;
  endTime: string;
};

export const QUARTER_OPTIONS = ["1st Quarter", "2nd Quarter"] as const;
export type QuarterOption = typeof QUARTER_OPTIONS[number];
export type QuarterRange = Record<QuarterOption, { startMonth: number | null; endMonth: number | null }>;

export interface RemedialPeriodFormValues {
  schoolYear: string;
  quarters: QuarterRange;
}
