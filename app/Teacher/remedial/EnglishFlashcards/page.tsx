import { Suspense } from "react";
import EnglishFlashcards from "@/modules/Teacher/remedial/EnglishTabs/Flashcards/flashcards";

export default function EnglishFlashcardsPage() {
  return (
    <Suspense fallback={null}>
      <EnglishFlashcards />
    </Suspense>
  );
}
