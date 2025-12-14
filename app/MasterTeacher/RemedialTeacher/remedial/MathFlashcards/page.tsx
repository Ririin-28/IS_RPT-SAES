import { Suspense } from "react";
import MathFlashcards from "@/modules/MasterTeacher/RemedialTeacher/remedial/MathTabs/Flashcards/flashcards";

export default function FilipinoFlashcardsPage() {
  return (
    <Suspense fallback={null}>
      <MathFlashcards />
    </Suspense>
  );
}