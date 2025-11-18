"use client";
import RemedialFlashcardsTemplate, { type RemedialFlashcardsConfig } from "@/modules/remedial/flashcards/RemedialFlashcardsTemplate";
import { ENGLISH_FLASHCARDS, ENGLISH_STUDENTS } from "@/modules/remedial/flashcards/presets";

const TEACHER_ENGLISH_CONFIG: RemedialFlashcardsConfig = {
  mode: "reading",
  subjectLabel: "English",
  levelLabel: "Non-Reader Level",
  storageNamespace: "TEACHER_REMEDIAL_ENGLISH",
  defaultRoster: ENGLISH_STUDENTS,
  defaultCards: ENGLISH_FLASHCARDS,
  startButtonLabel: "Start Remedial",
  speechOptions: {
    lang: "en-US",
    rate: 0.9,
    pitch: 1.1,
  },
};

export default function TeacherEnglishFlashcards() {
  return <RemedialFlashcardsTemplate config={TEACHER_ENGLISH_CONFIG} />;
}