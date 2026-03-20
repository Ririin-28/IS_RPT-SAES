import { Suspense } from "react";
import EnglishFlashcards from "@/modules/Teacher/remedial/EnglishTabs/Flashcards/flashcards";
import FlashcardsStatusScreen from "@/components/Common/Loaders/FlashcardsStatusScreen";

export default function EnglishFlashcardsPage() {
  return (
    <Suspense
      fallback={
        <FlashcardsStatusScreen
          title="Preparing remedial flashcards"
          message="Opening the remedial flashcards screen."
        />
      }
    >
      <EnglishFlashcards />
    </Suspense>
  );
}
