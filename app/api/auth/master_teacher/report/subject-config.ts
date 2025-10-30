import type { ComponentType } from "react";
import EnglishReportTab from "@/modules/MasterTeacher/RemedialTeacher/report/EnglishTab/EnglishTab";
import FilipinoReportTab from "@/modules/MasterTeacher/RemedialTeacher/report/FilipinoTab/FilipinoTab";
import MathReportTab from "@/modules/MasterTeacher/RemedialTeacher/report/MathTab/MathTab";

export type SubjectKey = "english" | "filipino" | "math";

export type SubjectConfig = {
  title: string;
  Component: ComponentType<Record<string, never>>;
};

export const SUBJECT_CONFIG: Record<SubjectKey, SubjectConfig> = {
  english: {
    title: "Progress Report for Grade Three - English",
    Component: EnglishReportTab,
  },
  filipino: {
    title: "Progress Report for Grade Three - Filipino",
    Component: FilipinoReportTab,
  },
  math: {
    title: "Progress Report for Grade Three - Mathematics",
    Component: MathReportTab,
  },
};

export const normalizeSubject = (slug?: string): SubjectKey => {
  const value = (slug ?? "english").toLowerCase();
  if (value === "filipino") return "filipino";
  if (value === "math" || value === "mathematics") return "math";
  return "english";
};
