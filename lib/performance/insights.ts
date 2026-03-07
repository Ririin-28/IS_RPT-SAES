export type ReaderPerformanceLevel =
  | "Non-Reader"
  | "Syllable"
  | "Word"
  | "Phrase"
  | "Sentence"
  | "Paragraph";

export type PerformanceQualityBand = "Poor" | "Fair" | "Average" | "Good" | "Excellent";

export type SlidePerformanceInsightInput = {
  accuracyScore?: number | null;
  readingSpeedWpm?: number | null;
  slideAverage?: number | null;
};

export type SlideFeedbackContext = {
  studentName?: string | null;
  difficultWords?: string[] | null;
};

export type SlidePerformanceInsight = {
  performanceLevel: ReaderPerformanceLevel;
  qualityBand: PerformanceQualityBand;
  strengths: string;
  weaknesses: string;
  nextStep: string;
};

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

export const getQualityBandFromAverage = (slideAverage: number | null | undefined): PerformanceQualityBand => {
  const average = clampPercent(toFiniteNumber(slideAverage), 0);
  if (average >= 90) return "Excellent";
  if (average >= 80) return "Good";
  if (average >= 70) return "Average";
  if (average >= 60) return "Fair";
  return "Poor";
};

const inferPerformanceLevel = (
  accuracy: number,
  readingSpeedWpm: number,
  qualityBand: PerformanceQualityBand,
): ReaderPerformanceLevel => {
  if (qualityBand === "Poor" || accuracy < 55 || readingSpeedWpm < 30) return "Non-Reader";
  if (qualityBand === "Fair" || accuracy < 65 || readingSpeedWpm < 45) return "Syllable";
  if (accuracy < 75 || readingSpeedWpm < 60) return "Word";
  if (accuracy < 82 || readingSpeedWpm < 80) return "Phrase";
  if (accuracy < 90 || readingSpeedWpm < 100) return "Sentence";
  return "Paragraph";
};

export const getSlidePerformanceInsight = (
  input: SlidePerformanceInsightInput,
): SlidePerformanceInsight => {
  const accuracy = clampPercent(toFiniteNumber(input.accuracyScore), 0);
  const readingSpeedWpm = clampNonNegative(toFiniteNumber(input.readingSpeedWpm), 0);
  const average = clampPercent(toFiniteNumber(input.slideAverage), 0);

  const qualityBand = getQualityBandFromAverage(average);
  const performanceLevel = inferPerformanceLevel(accuracy, readingSpeedWpm, qualityBand);

  const strengths: string[] = [];
  if (accuracy >= 85) strengths.push("You read many words correctly.");
  if (readingSpeedWpm >= 90) strengths.push("Your reading pace is strong.");
  if (average >= 85) strengths.push("You stayed consistent in this slide.");
  if (!strengths.length) strengths.push("Good effort finishing this slide.");

  const weaknesses: string[] = [];
  if (accuracy < 75) weaknesses.push("Let's work on reading tricky words correctly.");
  if (readingSpeedWpm < 60) weaknesses.push("Let's practice reading a little faster.");
  if (average < 70) weaknesses.push("This slide needs more practice.");
  if (!weaknesses.length) weaknesses.push("No big problems in this slide.");

  let nextStep = "Try this slide one more time and keep the same focus.";
  if (accuracy < 75) {
    nextStep = "Read the hard words slowly first, then try the whole slide again.";
  } else if (readingSpeedWpm < 60) {
    nextStep = "Read the slide twice and aim for a smoother pace.";
  } else if (qualityBand === "Good" || qualityBand === "Excellent") {
    nextStep = "Great job. Move to the next slide and keep this pace.";
  }

  return {
    performanceLevel,
    qualityBand,
    strengths: strengths.slice(0, 2).join(" "),
    weaknesses: weaknesses.slice(0, 2).join(" "),
    nextStep,
  };
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

const describeAccuracy = (value: number): string => {
  if (value >= 90) return "very clear";
  if (value >= 80) return "clear";
  if (value >= 70) return "getting better";
  if (value >= 60) return "still a bit shaky";
  return "still needs help";
};

const describeSpeed = (value: number): string => {
  if (value >= 110) return "very smooth";
  if (value >= 90) return "smooth";
  if (value >= 70) return "okay";
  if (value >= 50) return "a little slow";
  return "slow for now";
};

const describeOverall = (value: number): string => {
  if (value >= 90) return "excellent";
  if (value >= 80) return "great";
  if (value >= 70) return "good";
  if (value >= 60) return "fair";
  return "still improving";
};

export const composeRuleBasedSlideFeedbackParagraph = (
  input: SlidePerformanceInsightInput,
  context?: SlideFeedbackContext,
): string => {
  const insight = getSlidePerformanceInsight(input);
  const accuracy = clampPercent(toFiniteNumber(input.accuracyScore), 0);
  const readingSpeedWpm = clampNonNegative(toFiniteNumber(input.readingSpeedWpm), 0);
  const average = clampPercent(toFiniteNumber(input.slideAverage), 0);
  const firstName = toFirstName(context?.studentName);
  const difficultWords = normalizeWords(context?.difficultWords);
  const trickyWordsLine = difficultWords.length
    ? ` like ${joinWordsCasual(difficultWords)}`
    : "";
  const accuracyWord = describeAccuracy(accuracy);
  const speedWord = describeSpeed(readingSpeedWpm);
  const overallWord = describeOverall(average);

  let sentenceOne = `Nice work, ${firstName} is improving little by little.`;
  if (insight.qualityBand === "Excellent" || insight.qualityBand === "Good") {
    sentenceOne = `Hooray, ${firstName}'s reading sounds ${overallWord} today and the flow is ${speedWord}.`;
  } else if (insight.qualityBand === "Poor" || insight.qualityBand === "Fair") {
    sentenceOne = `Good try today, ${firstName} is still learning, and that's okay.`;
  }

  const sentenceTwo = `Word reading is ${accuracyWord}, so let's focus on tricky words${trickyWordsLine} and keep practicing those words together.`;
  return `${sentenceOne} ${sentenceTwo}`;
};
