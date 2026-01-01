import type { ComponentType } from "react";
import EnglishReportTab from "@/modules/Teacher/report/EnglishTab/EnglishTab";
import FilipinoReportTab from "@/modules/Teacher/report/FilipinoTab/FilipinoTab";
import MathReportTab from "@/modules/Teacher/report/MathTab/MathTab";
import type { RemedialReportComponentProps } from "@/modules/Teacher/report/types";

export type SubjectKey = "english" | "filipino" | "math";

export type SubjectConfig = {
  subjectLabel: string;
  Component: ComponentType<RemedialReportComponentProps>;
};

export const SUBJECT_CONFIG: Record<SubjectKey, SubjectConfig> = {
  english: {
    subjectLabel: "English",
    Component: EnglishReportTab,
  },
  filipino: {
    subjectLabel: "Filipino",
    Component: FilipinoReportTab,
  },
  math: {
    subjectLabel: "Mathematics",
    Component: MathReportTab,
  },
};

export const normalizeSubject = (slug?: string): SubjectKey => {
  const value = (slug ?? "english").toLowerCase();
  if (value === "filipino") return "filipino";
  if (value === "math" || value === "mathematics") return "math";
  return "english";
};
