"use server";

import { generateTensorflowSlideFeedback } from "@/lib/ml/slide-feedback";

export type SlideFeedbackActionInput = {
  studentName?: string | null;
  phonemicLevel?: string | null;
  difficultWords?: string[] | null;
  accuracyScore?: number | null;
  readingSpeedWpm?: number | null;
  slideAverage?: number | null;
};

export async function getSlideFeedbackAction(studentId: string, input: SlideFeedbackActionInput) {
  try {
    const result = await generateTensorflowSlideFeedback({
      studentId,
      ...input,
    });
    return { success: true, feedback: result.paragraph, predictedScore: result.predictedScore };
  } catch (error) {
    console.error("Failed to generate TensorFlow slide feedback:", error);
    return { success: false, error: "Failed to generate per-slide feedback." };
  }
}
