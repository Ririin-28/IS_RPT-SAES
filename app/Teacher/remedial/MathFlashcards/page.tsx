import { Suspense } from "react";
import MathFlashcards from "@/modules/Teacher/remedial/MathTabs/Flashcards/flashcards";

export default function MathFlashcardsPage() {
  return (
    <Suspense fallback={null}>
      <MathFlashcards />
    </Suspense>
  );
}
