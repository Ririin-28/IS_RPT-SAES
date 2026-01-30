import { Suspense } from "react";
import CoordinatorFlashcards from "@/modules/MasterTeacher/Coordinator/remedial/Flashcards/flashcards";

export default function MasterTeacherCoordinatorRemedialFlashcardsPage() {
	return (
		<Suspense fallback={
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#013300] mx-auto mb-4"></div>
					<p className="text-gray-600">Loading flashcards...</p>
				</div>
			</div>
		}>
			<CoordinatorFlashcards />
		</Suspense>
	);
}
