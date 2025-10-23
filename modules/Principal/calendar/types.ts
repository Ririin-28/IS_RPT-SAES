export const WEEKDAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
] as const;

export const GRADE_LEVELS = [1, 2, 3, 4, 5, 6] as const;

export type WeekdayKey = typeof WEEKDAYS[number]["key"];
export type GradeLevel = typeof GRADE_LEVELS[number];

export type GradeTimeRange = {
  startTime: string;
  endTime: string;
};

export type DaySchedule = {
  subject: string;
  grades: Record<GradeLevel, GradeTimeRange>;
};

export type RemedialSchedule = Record<WeekdayKey, DaySchedule>;

export type RemedialPeriodPayload = {
  id: number;
  title: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  schedule: RemedialSchedule;
};

const buildEmptyGradeSchedule = (): Record<GradeLevel, GradeTimeRange> => {
  return GRADE_LEVELS.reduce((acc, grade) => {
    acc[grade] = { startTime: "", endTime: "" };
    return acc;
  }, {} as Record<GradeLevel, GradeTimeRange>);
};

export const createEmptyDaySchedule = (): DaySchedule => ({
  subject: "",
  grades: buildEmptyGradeSchedule(),
});

export const createEmptySchedule = (): RemedialSchedule => {
  return WEEKDAYS.reduce((acc, { key }) => {
    acc[key] = createEmptyDaySchedule();
    return acc;
  }, {} as RemedialSchedule);
};
