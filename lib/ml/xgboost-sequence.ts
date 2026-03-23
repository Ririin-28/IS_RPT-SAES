import fs from "fs/promises";
import path from "path";
import { type StudentHistorySnapshot } from "@/lib/ml/dataset";

export type XgboostSequenceInput = {
  history: StudentHistorySnapshot | null;
  accuracyScore: number;
  readingSpeedWpm: number;
  slideAverage: number;
};

type XgbTree = {
  featureIndex: number;
  threshold: number;
  leftValue: number;
  rightValue: number;
  weight?: number;
};

type XgbModelArtifact = {
  version: string;
  baseScore: number;
  clipMin?: number;
  clipMax?: number;
  trees: XgbTree[];
};

const MODEL_ARTIFACT_PATH = path.join(
  process.cwd(),
  "public",
  "models",
  "performance-xgb",
  "ensemble.json",
);

let cachedArtifact: XgbModelArtifact | null = null;
let artifactLoaded = false;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const mean = (values: number[]): number => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : 0;

const standardDeviation = (values: number[]): number => {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / values.length;
  return Math.sqrt(variance);
};

const linearSlope = (valuesOldestToNewest: number[]): number => {
  if (valuesOldestToNewest.length <= 1) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let index = 0; index < valuesOldestToNewest.length; index += 1) {
    const x = index;
    const y = valuesOldestToNewest[index];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const n = valuesOldestToNewest.length;
  const numerator = (n * sumXY) - (sumX * sumY);
  const denominator = (n * sumXX) - (sumX * sumX);
  if (!denominator) return 0;
  return numerator / denominator;
};

const ema = (valuesOldestToNewest: number[], alpha = 0.6): number => {
  if (!valuesOldestToNewest.length) return 0;
  let current = valuesOldestToNewest[0];
  for (let index = 1; index < valuesOldestToNewest.length; index += 1) {
    current = (alpha * valuesOldestToNewest[index]) + ((1 - alpha) * current);
  }
  return current;
};

const normalize = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
};

const speedToNormalizedScore = (wpm: number): number => {
  if (wpm >= 110) return 0.95;
  if (wpm >= 90) return 0.88;
  if (wpm >= 75) return 0.8;
  if (wpm >= 60) return 0.72;
  if (wpm >= 45) return 0.64;
  return 0.52;
};

const buildFeatureVector = (input: XgboostSequenceInput): number[] => {
  const sessions = input.history?.sessions ?? 0;
  const phonemicLevel = input.history?.phonemicLevel ?? 1;
  const recentNewestToOldest = (input.history?.recentScores ?? []).slice(0, 5);
  const recentOldestToNewest = [...recentNewestToOldest].reverse();

  const historicalMean = recentNewestToOldest.length
    ? mean(recentNewestToOldest)
    : clamp(input.slideAverage, 0, 100);
  const historicalStd = standardDeviation(recentNewestToOldest);
  const historicalSlope = linearSlope(recentOldestToNewest);
  const newestHistory = recentNewestToOldest[0] ?? historicalMean;
  const oldestHistory = recentOldestToNewest[0] ?? historicalMean;
  const previousHistory = recentNewestToOldest[1] ?? newestHistory;
  const historicalRange = recentNewestToOldest.length
    ? (Math.max(...recentNewestToOldest) - Math.min(...recentNewestToOldest))
    : 0;
  const historicalEma = ema(recentOldestToNewest.length ? recentOldestToNewest : [historicalMean]);

  const currentAccuracyNorm = normalize(clamp(input.accuracyScore, 0, 100), 0, 100);
  const currentSpeedNorm = normalize(clamp(input.readingSpeedWpm, 0, 150), 0, 150);
  const currentAverageNorm = normalize(clamp(input.slideAverage, 0, 100), 0, 100);
  const historicalMeanNorm = normalize(historicalMean, 0, 100);
  const historicalStdNorm = normalize(historicalStd, 0, 25);
  const historicalSlopeNorm = normalize(historicalSlope, -10, 10);
  const newestHistNorm = normalize(newestHistory, 0, 100);
  const oldestHistNorm = normalize(oldestHistory, 0, 100);
  const momentumNorm = normalize(newestHistory - previousHistory, -20, 20);
  const deltaCurrentVsHistNorm = normalize(input.slideAverage - historicalMean, -30, 30);
  const historicalRangeNorm = normalize(historicalRange, 0, 40);
  const historicalEmaNorm = normalize(historicalEma, 0, 100);
  const consistencyNorm = 1 - historicalStdNorm;
  const sessionsNorm = normalize(sessions, 0, 20);
  const levelNorm = normalize(phonemicLevel, 1, 5);
  const levelPerformanceInteraction = levelNorm * historicalMeanNorm;
  const currentVsRecentNorm = normalize(input.slideAverage - newestHistory, -25, 25);
  const speedAccuracyBalance = 1 - Math.abs(currentAccuracyNorm - speedToNormalizedScore(input.readingSpeedWpm));

  return [
    sessionsNorm,
    levelNorm,
    historicalMeanNorm,
    historicalStdNorm,
    historicalSlopeNorm,
    newestHistNorm,
    oldestHistNorm,
    momentumNorm,
    currentAccuracyNorm,
    currentSpeedNorm,
    currentAverageNorm,
    deltaCurrentVsHistNorm,
    historicalRangeNorm,
    historicalEmaNorm,
    consistencyNorm,
    levelPerformanceInteraction,
    currentVsRecentNorm,
    speedAccuracyBalance,
  ];
};

const DEFAULT_MODEL: XgbModelArtifact = {
  version: "xgb-sequence-v1",
  baseScore: 68,
  clipMin: 30,
  clipMax: 99,
  trees: [
    { featureIndex: 10, threshold: 0.9, leftValue: -3.2, rightValue: 5.8 },
    { featureIndex: 8, threshold: 0.85, leftValue: -3.1, rightValue: 5.2 },
    { featureIndex: 9, threshold: 0.62, leftValue: -2.0, rightValue: 3.2 },
    { featureIndex: 11, threshold: 0.58, leftValue: -2.4, rightValue: 3.6 },
    { featureIndex: 4, threshold: 0.5, leftValue: -1.8, rightValue: 2.4 },
    { featureIndex: 14, threshold: 0.55, leftValue: -1.7, rightValue: 2.1 },
    { featureIndex: 12, threshold: 0.55, leftValue: 1.5, rightValue: -1.4 },
    { featureIndex: 16, threshold: 0.5, leftValue: -1.2, rightValue: 1.9 },
    { featureIndex: 17, threshold: 0.55, leftValue: -1.4, rightValue: 1.8 },
    { featureIndex: 15, threshold: 0.45, leftValue: -1.1, rightValue: 1.4 },
    { featureIndex: 2, threshold: 0.75, leftValue: -1.3, rightValue: 1.7 },
    { featureIndex: 13, threshold: 0.78, leftValue: -1.1, rightValue: 1.6 },
    { featureIndex: 5, threshold: 0.8, leftValue: -1.1, rightValue: 1.6 },
    { featureIndex: 3, threshold: 0.45, leftValue: 1.1, rightValue: -1.5 },
    { featureIndex: 7, threshold: 0.5, leftValue: -0.9, rightValue: 1.3 },
    { featureIndex: 6, threshold: 0.7, leftValue: -0.8, rightValue: 1.2 },
    { featureIndex: 0, threshold: 0.25, leftValue: -0.5, rightValue: 0.9 },
    { featureIndex: 1, threshold: 0.4, leftValue: -0.6, rightValue: 1.0 },
    { featureIndex: 10, threshold: 0.75, leftValue: -1.0, rightValue: 1.5, weight: 0.8 },
    { featureIndex: 8, threshold: 0.78, leftValue: -1.0, rightValue: 1.5, weight: 0.8 },
    { featureIndex: 9, threshold: 0.5, leftValue: -0.8, rightValue: 1.2, weight: 0.7 },
    { featureIndex: 17, threshold: 0.62, leftValue: -0.8, rightValue: 1.1, weight: 0.7 },
  ],
};

const isValidTree = (value: unknown): value is XgbTree => {
  if (!value || typeof value !== "object") return false;
  const tree = value as Partial<XgbTree>;
  return Number.isFinite(tree.featureIndex)
    && Number.isFinite(tree.threshold)
    && Number.isFinite(tree.leftValue)
    && Number.isFinite(tree.rightValue)
    && (tree.weight === undefined || Number.isFinite(tree.weight));
};

const isValidArtifact = (value: unknown): value is XgbModelArtifact => {
  if (!value || typeof value !== "object") return false;
  const artifact = value as Partial<XgbModelArtifact>;
  return typeof artifact.version === "string"
    && Number.isFinite(artifact.baseScore)
    && Array.isArray(artifact.trees)
    && artifact.trees.every((tree) => isValidTree(tree))
    && (artifact.clipMin === undefined || Number.isFinite(artifact.clipMin))
    && (artifact.clipMax === undefined || Number.isFinite(artifact.clipMax));
};

const getModel = async (): Promise<XgbModelArtifact> => {
  if (artifactLoaded) {
    return cachedArtifact ?? DEFAULT_MODEL;
  }

  artifactLoaded = true;
  try {
    const payload = await fs.readFile(MODEL_ARTIFACT_PATH, "utf-8");
    const parsed = JSON.parse(payload) as unknown;
    if (isValidArtifact(parsed)) {
      cachedArtifact = parsed;
      return parsed;
    }
  } catch {
    // Ignore artifact load errors and use the bundled default model.
  }

  cachedArtifact = null;
  return DEFAULT_MODEL;
};

const predictFromTrees = (features: number[], model: XgbModelArtifact): number => {
  let score = model.baseScore;

  for (const tree of model.trees) {
    const value = features[tree.featureIndex] ?? 0;
    const nodeOutput = value <= tree.threshold ? tree.leftValue : tree.rightValue;
    score += nodeOutput * (tree.weight ?? 1);
  }

  const min = model.clipMin ?? 0;
  const max = model.clipMax ?? 100;
  return clamp(score, min, max);
};

export async function predictNextScoreXgboostSequence(
  input: XgboostSequenceInput,
): Promise<number | null> {
  const model = await getModel();
  const features = buildFeatureVector(input);
  const score = predictFromTrees(features, model);
  return Number.isFinite(score) ? Math.round(score) : null;
}
