import { getStudentFeatures, getStudentHistorySnapshot } from "@/lib/ml/dataset";
import { predictStudentScore } from "@/lib/ml/server-inference";
import { predictTutorAction, getTutorTemplate } from "@/lib/ml/tutor-classifier";
import { predictNextScoreXgboostSequence } from "@/lib/ml/xgboost-sequence";

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

type GuidanceBand = "very-strong" | "strong" | "developing" | "needs-support";

const lastCoachingVariantByStudent = new Map<string, { band: GuidanceBand; index: number }>();

const clampScore = (value: number): number => Math.max(0, Math.min(100, value));

const toScore = (value: number | null | undefined): number => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return clampScore(value);
};

const normalizeWords = (values: string[] | null | undefined): string[] => {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of values) {
    const word = (raw ?? "").trim();
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(word);
    if (output.length >= 3) break;
  }
  return output;
};

const joinWordsCasual = (words: string[]): string => {
  if (!words.length) return "";
  if (words.length === 1) return words[0];
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words[0]}, ${words[1]}, and ${words[2]}`;
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const speedToScore = (wpm: number): number => {
  if (wpm >= 110) return 95;
  if (wpm >= 90) return 88;
  if (wpm >= 75) return 80;
  if (wpm >= 60) return 72;
  if (wpm >= 45) return 64;
  return 52;
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

const getBlendedNextSlideScore = (
  predictedScore: number | null,
  accuracy: number,
  readingSpeedWpm: number,
  slideAverage: number,
): number => {
  const liveSignal = clampScore(
    (accuracy * 0.45) +
      (slideAverage * 0.45) +
      (speedToScore(readingSpeedWpm) * 0.1),
  );

  if (typeof predictedScore !== "number" || Number.isNaN(predictedScore) || !Number.isFinite(predictedScore)) {
    return liveSignal;
  }

  const predicted = clampScore(predictedScore);
  const gap = Math.abs(predicted - liveSignal);
  const predictionWeight = gap > 25 ? 0.2 : gap > 15 ? 0.3 : 0.4;

  return clampScore((liveSignal * (1 - predictionWeight)) + (predicted * predictionWeight));
};

const buildMlInterpretation = (effectiveScore: number): string => {
  if (effectiveScore >= 85) return "can likely do very well on the next slide";
  if (effectiveScore >= 70) return "can likely do well on the next slide";
  if (effectiveScore >= 55) return "can improve on the next slide with a little guidance";
  return "may need extra guidance before moving to the next slide";
};

const getGuidanceBand = (effectiveScore: number): GuidanceBand => {
  if (effectiveScore >= 85) return "very-strong";
  if (effectiveScore >= 70) return "strong";
  if (effectiveScore >= 55) return "developing";
  return "needs-support";
};

const buildCoachingLine = (
  studentId: string,
  firstName: string,
  effectiveScore: number,
  accuracy: number,
  readingSpeedWpm: number,
  difficultWords: string[],
): string => {
  const difficultWordsText = joinWordsCasual(difficultWords);
  const hasDifficultWords = difficultWords.length > 0;
  const band = getGuidanceBand(effectiveScore);

  const templates: Record<GuidanceBand, string[]> = {
    "very-strong": [
      hasDifficultWords
        ? `${firstName}, keep your momentum and make ${difficultWordsText} just as smooth as the rest.`
        : `${firstName}, keep this smooth rhythm and expressive voice on the next card.`,
      hasDifficultWords
        ? `Excellent pacing, ${firstName}. On the next slide, give a quick extra check to ${difficultWordsText}.`
        : `Excellent pacing, ${firstName}. Bring the same confidence to the next slide.`,
      `That was clear and confident, ${firstName}. Aim for the same quality again on the next slide.`,
    ],
    strong: [
      hasDifficultWords
        ? `${firstName}, you're close to excellent. A quick review of ${difficultWordsText} will make the next slide even better.`
        : `${firstName}, you're doing well. Keep the same clarity and add a little more expression next slide.`,
      readingSpeedWpm < 70
        ? `${firstName}, accuracy is strong. Add a little more pace and you'll sound even more natural.`
        : `${firstName}, your pace is good. Focus on crisp word endings to level up further.`,
      `Nice control, ${firstName}. Let's keep this consistency from start to finish on the next card.`,
    ],
    developing: [
      hasDifficultWords
        ? `${firstName}, let's sharpen ${difficultWordsText} first, then read the full sentence again.`
        : `${firstName}, let's do one focused repeat and keep each word clear.`,
      accuracy < 75
        ? `${firstName}, point to each word as you read so accuracy stays steady.`
        : `${firstName}, slow breaths between phrases can help your flow on the next try.`,
      `Good effort, ${firstName}. One guided repeat can lift this to a stronger score.`,
    ],
    "needs-support": [
      hasDifficultWords
        ? `${firstName}, we will tackle ${difficultWordsText} step by step, then blend them into the full sentence.`
        : `${firstName}, we will break the sentence into small parts and read each part clearly.`,
      `Let's use echo reading, ${firstName}: listen once, then repeat with the same rhythm.`,
      `${firstName}, we can do this. Accuracy first, then pace once each word is stable.`,
    ],
  };

  const options = templates[band];
  const seed = hashString(
    `${studentId}|${Math.round(effectiveScore)}|${Math.round(accuracy)}|${readingSpeedWpm}|${difficultWords.join("|")}`,
  );
  let selectedIndex = seed % options.length;
  const previous = lastCoachingVariantByStudent.get(studentId);

  if (previous && previous.band === band && previous.index === selectedIndex && options.length > 1) {
    selectedIndex = (selectedIndex + 1) % options.length;
  }

  lastCoachingVariantByStudent.set(studentId, { band, index: selectedIndex });
  return options[selectedIndex];
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
  const difficultWords = normalizeWords(input.difficultWords);
  const levelFromInput = mapPhonemicLevelToModelIndex(input.phonemicLevel);
  const firstName = toFirstName(input.studentName);

  // 1. ML: Classify the "Tutor Action" needed based on current performance
  const tutorCategory = await predictTutorAction(accuracy, readingSpeedWpm, slideAverage);
  const tutorFeedback = getTutorTemplate(tutorCategory, firstName);

  const historySnapshot = await getStudentHistorySnapshot(input.studentId);

  let predictedScoreFromTf: number | null = null;
  let predictedScore: number | null = null;
  try {
    const historicalFeatures = historySnapshot
      ? [historySnapshot.sessions, historySnapshot.phonemicLevel, historySnapshot.avgScore]
      : await getStudentFeatures(input.studentId);
    const features = historicalFeatures
      ? [
          Math.max(0, Math.round(historicalFeatures[0] ?? 0)),
          levelFromInput || Math.max(1, Math.round(historicalFeatures[1] ?? 1)),
          clampScore(Math.round(((historicalFeatures[2] ?? slideAverage) * 0.7) + (slideAverage * 0.3))),
        ]
      : [1, levelFromInput, slideAverage];

    predictedScoreFromTf = await predictStudentScore(features);
  } catch {
    predictedScoreFromTf = null;
  }

  const predictedScoreFromXgb = await predictNextScoreXgboostSequence({
    history: historySnapshot,
    accuracyScore: accuracy,
    readingSpeedWpm,
    slideAverage,
  });

  if (
    typeof predictedScoreFromXgb === "number"
    && Number.isFinite(predictedScoreFromXgb)
    && typeof predictedScoreFromTf === "number"
    && Number.isFinite(predictedScoreFromTf)
  ) {
    predictedScore = Math.round((predictedScoreFromXgb * 0.7) + (predictedScoreFromTf * 0.3));
  } else if (typeof predictedScoreFromXgb === "number" && Number.isFinite(predictedScoreFromXgb)) {
    predictedScore = predictedScoreFromXgb;
  } else if (typeof predictedScoreFromTf === "number" && Number.isFinite(predictedScoreFromTf)) {
    predictedScore = Math.round(predictedScoreFromTf);
  } else {
    predictedScore = null;
  }

  const effectiveNextSlideScore = getBlendedNextSlideScore(
    predictedScore,
    accuracy,
    readingSpeedWpm,
    slideAverage,
  );

  const predictiveInsight = typeof predictedScore === "number" && Number.isFinite(predictedScore)
    ? `Based on recent work, ${firstName} ${buildMlInterpretation(effectiveNextSlideScore)}.`
    : `With one more guided try, ${firstName} can do better on the next slide.`;

  const coachingLine = buildCoachingLine(
    input.studentId,
    firstName,
    effectiveNextSlideScore,
    accuracy,
    readingSpeedWpm,
    difficultWords,
  );

  return {
    paragraph: `${tutorFeedback} ${predictiveInsight} ${coachingLine}`,
    predictedScore: typeof predictedScore === "number" && Number.isFinite(predictedScore)
      ? Math.round(clampScore(predictedScore))
      : null,
  };
}
