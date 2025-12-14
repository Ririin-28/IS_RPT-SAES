import { Suspense } from "react";
import FilipinoFlashcards from "@/modules/Teacher/remedial/FilipinoTabs/Flashcards/flashcards";

export default function FilipinoFlashcardsPage() {
  return (
    <Suspense fallback={null}>
      <FilipinoFlashcards />
    </Suspense>
  );
}
