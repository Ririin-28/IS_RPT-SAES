import { Suspense } from "react";
import FilipinoFlashcards from "@/modules/MasterTeacher/RemedialTeacher/remedial/FilipinoTabs/Flashcards/flashcards";

export default function FilipinoFlashcardsPage() {
  return (
    <Suspense fallback={null}>
      <FilipinoFlashcards />
    </Suspense>
  );
}