import { predictStudentScore } from "@/lib/ml/server-inference";
import { getStudentFeatures } from "@/lib/ml/dataset";
import { predictFeedbackCategory, getFeedbackTemplate, getEncouragement } from "@/lib/ml/feedback-classifier";

export type SessionMetrics = {
  pronunciationAvg?: number;
  accuracyAvg: number;
  fluencyScore?: number;
  readingSpeedAvg?: number;
  responseTimeAvg?: number;
  overallAverage: number;
  phonemicLevel?: string;
  difficultWords?: string[];
  strongWords?: string[];
  sessionTexts?: string[];
};

type ReadingIssue = "silent_letters" | "long_words" | "vowel_a" | "general_decoding";

const toFiniteNumber = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Number.isFinite(value) ? value : null;
};

const clampPercent = (value: number | null, fallback = 0): number => {
  if (value === null) return fallback;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

const clampNonNegative = (value: number | null, fallback = 0): number => {
  if (value === null) return fallback;
  return value < 0 ? 0 : value;
};

const toFirstName = (value: string | null | undefined): string => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "Student";

  let candidate = trimmed;
  if (trimmed.includes(",")) {
    const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
    candidate = parts[1] ?? parts[0] ?? trimmed;
  }

  const [firstToken] = candidate.split(/\s+/);
  const cleaned = (firstToken ?? "").replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "");
  return cleaned || "Student";
};

const tokenizeWords = (value: string | null | undefined): string[] => {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return [];
  return raw
    .replace(/[^a-zA-Z\s']/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3);
};

const uniqueWords = (values: Array<string | null | undefined>, limit = 6): string[] => {
  const output: string[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    const word = (raw ?? "").trim();
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(word);
    if (output.length >= limit) break;
  }

  return output;
};

const joinWords = (words: string[]): string => {
  if (!words.length) return "";
  if (words.length === 1) return words[0];
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words[0]}, ${words[1]}, and ${words[2]}`;
};

const SILENT_LETTER_PATTERN = /^(kn|wr|gn|ps|pt|pn|rh)|mb$|bt$|mn$|lk$|stle$/i;

const inferReadingIssue = (
  difficultWords: string[],
  accuracy: number,
  readingSpeedWpm: number,
): ReadingIssue => {
  if (difficultWords.some((word) => SILENT_LETTER_PATTERN.test(word))) {
    return "silent_letters";
  }

  const longWordsCount = difficultWords.filter((word) => word.length >= 8).length;
  if (longWordsCount >= 2 || (accuracy < 78 && readingSpeedWpm >= 95)) {
    return "long_words";
  }

  const wordsWithA = difficultWords.filter((word) => /a/i.test(word)).length;
  if (wordsWithA >= 2) {
    return "vowel_a";
  }

  return "general_decoding";
};

const pickFallbackWords = (
  preferred: string[],
  backup: string[],
  sessionTexts: string[],
): string[] => {
  const preferredSet = uniqueWords(preferred, 3);
  if (preferredSet.length >= 2) return preferredSet;

  const backupSet = uniqueWords(backup, 3);
  if (backupSet.length >= 2) return backupSet;

  const textWords = uniqueWords(
    sessionTexts.flatMap((text) => tokenizeWords(text).filter((word) => word.length >= 5)),
    3,
  );
  return textWords.length ? textWords : ["practice words"];
};

const generateReadingInsight = async (metrics: SessionMetrics, studentName?: string): Promise<string> => {
  const name = toFirstName(studentName);
  const overallAverage = clampPercent(toFiniteNumber(metrics.overallAverage), 0);
  const accuracy = clampPercent(toFiniteNumber(metrics.accuracyAvg), overallAverage);
  const readingSpeedWpm = clampNonNegative(toFiniteNumber(metrics.readingSpeedAvg), 0);
  
  // ML-Based Decision Making
  // The model analyzes accuracy, speed, and overall performance to classify the student's needs.
  const category = await predictFeedbackCategory(accuracy, readingSpeedWpm, overallAverage);
  const baseFeedback = getFeedbackTemplate(category, name);
  const encouragement = getEncouragement(category, name);

  // Rule-Based Evidence Extraction
  // We supplement the ML strategy with specific examples from the session data.
  const sessionTexts = Array.isArray(metrics.sessionTexts) ? metrics.sessionTexts.filter(Boolean) : [];
  const difficultWords = uniqueWords(metrics.difficultWords ?? [], 8);
  const strongWords = uniqueWords(metrics.strongWords ?? [], 8);
  const struggleExamples = pickFallbackWords(difficultWords, strongWords, sessionTexts);
  const strengthExamples = pickFallbackWords(strongWords, difficultWords, sessionTexts);
  const issue = inferReadingIssue(struggleExamples, accuracy, readingSpeedWpm);

  let specificAdvice = "";
  if (issue === "silent_letters") {
    specificAdvice = `Specifically, practice silent letters like in ${joinWords(struggleExamples)}.`;
  } else if (issue === "long_words") {
    specificAdvice = `Try chunking long words like ${joinWords(struggleExamples)}.`;
  } else if (issue === "vowel_a") {
    specificAdvice = `Review 'A' sounds in words like ${joinWords(struggleExamples)}.`;
  } else if (difficultWords.length > 0) {
    specificAdvice = `Review tricky words like ${joinWords(struggleExamples)}.`;
  }

  let strengthNote = "";
  if (strongWords.length > 0) {
    strengthNote = `Also, ${name} did a great job with words like ${joinWords(strengthExamples)}.`;
  }

  return `${encouragement} ${baseFeedback} ${strengthNote} ${specificAdvice}`;
};

export async function generateAiInsight(
  studentId: string,
  metrics: SessionMetrics,
  studentName?: string,
  subject: "English" | "Filipino" | "Math" = "English",
): Promise<string> {
  if (subject !== "Math") {
    return await generateReadingInsight(metrics, studentName);
  }

  const name = toFirstName(studentName);
  const features = await getStudentFeatures(studentId);
  let riskLevel = "Unknown";
  let trend = "stable";

  if (features) {
    const avgHistorical = features[2];
    if (metrics.overallAverage > avgHistorical + 5) trend = "improving";
    else if (metrics.overallAverage < avgHistorical - 5) trend = "declining";

    const result = await predictStudentScore(features);
    if (result !== null) {
      riskLevel = result < 75 ? "High" : "Low";
    }
  }

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (metrics.accuracyAvg >= 85) strengths.push("problem solving accuracy");
  else if (metrics.accuracyAvg < 75) weaknesses.push("calculation accuracy");

  if ((metrics.responseTimeAvg ?? 10) <= 5) strengths.push("speed and efficiency");
  else if ((metrics.responseTimeAvg ?? 0) > 10) weaknesses.push("processing speed");

  if (trend === "improving") strengths.push("consistent progress");
  if (trend === "declining") weaknesses.push("recent performance regression");

  let intro = "";
  if (riskLevel === "High") {
    intro = `${name} may need extra support in the next assessment.`;
  } else if (riskLevel === "Low") {
    intro = `${name} is on track in this math session.`;
  } else {
    intro = `${name} has finished this math session.`;
  }

  let body = "";
  if (strengths.length > 0 && weaknesses.length > 0) {
    body = `${name} shows strength in ${strengths[0]} but still needs work on ${weaknesses[0]}.`;
  } else if (strengths.length > 0) {
    body = `${name} did well in ${strengths.join(" and ")}.`;
  } else if (weaknesses.length > 0) {
    body = `${name} needs more practice in ${weaknesses.join(" and ")}.`;
  } else {
    body = "Performance is balanced for this session.";
  }

  let recommendation = "";
  if (weaknesses.includes("processing speed")) {
    recommendation = `${name} should do short timed drills 2 times a day.`;
  } else if (weaknesses.includes("calculation accuracy")) {
    recommendation = `${name} should review basic operations and practice slowly before timed work.`;
  } else if (riskLevel === "High") {
    recommendation = `${name} should attend guided remedial practice this week.`;
  } else {
    recommendation = `${name} should continue the current math practice routine.`;
  }

  if (trend === "improving") {
    recommendation += " Recent progress is encouraging.";
  }

  return `${intro} ${body} ${recommendation}`;
}
