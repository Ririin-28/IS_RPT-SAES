import { Suspense } from "react";
import MathFlashcards from "@/modules/MasterTeacher/RemedialTeacher/remedial/MathTabs/Flashcards/flashcards";
import FlashcardsStatusScreen from "@/components/Common/Loaders/FlashcardsStatusScreen";

export default function FilipinoFlashcardsPage() {
  return (
    <Suspense
      fallback={
        <FlashcardsStatusScreen
          title="Preparing remedial flashcards"
          message="Opening the remedial flashcards screen."
        />
      }
    >
      <MathFlashcards />
    </Suspense>
  );
}
