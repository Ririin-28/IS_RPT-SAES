import { Suspense } from "react";
import FilipinoFlashcards from "@/modules/MasterTeacher/RemedialTeacher/remedial/FilipinoTabs/Flashcards/flashcards";
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
      <FilipinoFlashcards />
    </Suspense>
  );
}
