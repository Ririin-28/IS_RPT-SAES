import { Suspense } from "react";
import MasterTeacherEnglishRemedialFlashcards from "@/modules/MasterTeacher/Coordinator/remedial/Flashcards/flashcards";

export default function MasterTeacherCoordinatorEnglishFlashcardsPage() {
  return (
    <Suspense fallback={null}>
      <MasterTeacherEnglishRemedialFlashcards />
    </Suspense>
  );
}
