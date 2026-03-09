import { getStudentFeatures } from "@/lib/ml/dataset";
import { predictStudentScore } from "@/lib/ml/server-inference";
import { predictTutorAction, getTutorTemplate } from "@/lib/ml/tutor-classifier";

export type TensorflowSlideFeedbackInput = {
  studentId: string;
  studentName?: string | null;
  phonemicLevel?: string | null;
  difficultWords?: string[] | null;
  accuracyScore?: number | null;
  readingSpeedWpm?: number | null;
  slideAverage?: number | null;
};

export type TensorflowSlideFeedbackResult = {
  paragraph: string;
  predictedScore: number | null;
};

const clampScore = (value: number): number => Math.max(0, Math.min(100, value));

const toScore = (value: number | null | undefined): number => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return clampScore(value);
};

const mapPhonemicLevelToModelIndex = (value: string | null | undefined): number => {
  const normalized = (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized) return 1;
  if (normalized.includes("nonreader")) return 1;
  if (normalized.includes("syllable")) return 2;
  if (normalized.includes("word")) return 3;
  if (normalized.includes("phrase")) return 4;
  if (normalized.includes("sentence")) return 4;
  if (normalized.includes("paragraph")) return 5;
  return 1;
};

const buildMlInterpretation = (predictedScore: number): string => {
  if (predictedScore >= 85) return "can likely do very well on the next slide";
  if (predictedScore >= 70) return "can likely do well on the next slide";
  if (predictedScore >= 55) return "can improve on the next slide with a little guidance";
  return "may need extra guidance before moving to the next slide";
};

const toFirstName = (value: string | null | undefined): string => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "the student";
  const [first] = trimmed.split(/\s+/);
  return (first ?? "the student").replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "") || "the student";
};

export async function generateTensorflowSlideFeedback(
  input: TensorflowSlideFeedbackInput,
): Promise<TensorflowSlideFeedbackResult> {
  const accuracy = toScore(input.accuracyScore);
  const readingSpeedWpm = Math.max(0, Math.round(input.readingSpeedWpm ?? 0));
  const slideAverage = toScore(input.slideAverage);
  const levelFromInput = mapPhonemicLevelToModelIndex(input.phonemicLevel);
  const firstName = toFirstName(input.studentName);

  // 1. ML: Classify the "Tutor Action" needed based on current performance
  const tutorCategory = await predictTutorAction(accuracy, readingSpeedWpm, slideAverage);
  const tutorFeedback = getTutorTemplate(tutorCategory, firstName);

  let predictedScore: number | null = null;
  try {
    const historicalFeatures = await getStudentFeatures(input.studentId);
    const features = historicalFeatures
      ? [
          Math.max(0, Math.round(historicalFeatures[0] ?? 0)),
          levelFromInput || Math.max(1, Math.round(historicalFeatures[1] ?? 1)),
          clampScore(Math.round(((historicalFeatures[2] ?? slideAverage) * 0.7) + (slideAverage * 0.3))),
        ]
      : [1, levelFromInput, slideAverage];

    predictedScore = await predictStudentScore(features);
  } catch {
    predictedScore = null;
  }

  const predictiveInsight = typeof predictedScore === "number" && Number.isFinite(predictedScore)
    ? `Based on recent work, ${firstName} ${buildMlInterpretation(predictedScore)}.`
    : `With one more guided try, ${firstName} can do better on the next slide.`;

  return {
    paragraph: `${tutorFeedback} ${predictiveInsight}`,
    predictedScore: typeof predictedScore === "number" && Number.isFinite(predictedScore)
      ? Math.round(clampScore(predictedScore))
      : null,
  };
}
