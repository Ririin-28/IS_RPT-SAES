export type SubjectKey = "english" | "filipino" | "math";

export type RemedialReportRow = {
  id: string;
  learner: string;
  section: string;
  gradeLevel: string;
  preAssessment: string;
  october: string;
  december: string;
  midYear: string;
  postAssessment: string;
  endingProfile: string;
};

export type RemedialReportField = keyof Pick<
  RemedialReportRow,
  "preAssessment" | "october" | "december" | "midYear" | "postAssessment" | "endingProfile"
>;

export type RemedialReportComponentProps = {
  rows: RemedialReportRow[];
  editable: boolean;
  onCellChange: (index: number, field: RemedialReportField, value: string) => void;
};

export const REMEDIAL_REPORT_FIELDS: RemedialReportField[] = [
  "preAssessment",
  "october",
  "december",
  "midYear",
  "postAssessment",
  "endingProfile",
];

export type RemedialStudentRecord = {
  studentId: number | null;
  userId: number | null;
  remedialId: number | null;
  studentIdentifier: string | null;
  lrn: string | null;
  grade: string | null;
  section: string | null;
  english: string | null;
  filipino: string | null;
  math: string | null;
  guardian: string | null;
  guardianContact: string | null;
  guardianEmail?: string | null;
  parentFirstName?: string | null;
  parentMiddleName?: string | null;
  parentLastName?: string | null;
  parentSuffix?: string | null;
  relationship?: string | null;
  address: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  suffix?: string | null;
  fullName: string | null;
  englishStartingLevel: string | null;
  englishSeptLevel: string | null;
  englishOctLevel: string | null;
  englishDecLevel: string | null;
  englishFebLevel: string | null;
  filipinoStartingLevel: string | null;
  filipinoSeptLevel: string | null;
  filipinoOctLevel: string | null;
  filipinoDecLevel: string | null;
  filipinoFebLevel: string | null;
  mathStartingLevel: string | null;
  mathSeptLevel: string | null;
  mathOctLevel: string | null;
  mathDecLevel: string | null;
  mathFebLevel: string | null;
  latestEnglishLevel: string | null;
  latestFilipinoLevel: string | null;
  latestMathLevel: string | null;
};

export type RemedialStudentResponse = {
  success: boolean;
  students?: RemedialStudentRecord[];
  error?: string;
};
