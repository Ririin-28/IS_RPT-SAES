export type PhonemicSubjectName = "English" | "Filipino" | "Math";

export const CANONICAL_PHONEMIC_LEVELS: Record<PhonemicSubjectName, string[]> = {
  English: ["Non-Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"],
  Filipino: ["Non-Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"],
  Math: ["Not Proficient", "Low Proficient", "Nearly Proficient", "Proficient", "Highly Proficient"],
};

export const normalizePhonemicLevelName = (value: unknown): string =>
  String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const LEVEL_RANK_BY_SUBJECT = Object.fromEntries(
  Object.entries(CANONICAL_PHONEMIC_LEVELS).map(([subject, levels]) => [
    subject,
    new Map(levels.map((level, index) => [normalizePhonemicLevelName(level), index] as const)),
  ]),
) as Record<PhonemicSubjectName, Map<string, number>>;

export const toPhonemicSubjectName = (value: unknown): PhonemicSubjectName | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "english" || normalized.startsWith("eng")) return "English";
  if (normalized === "filipino" || normalized.startsWith("fil")) return "Filipino";
  if (normalized === "math" || normalized === "mathematics") return "Math";
  return null;
};

export const comparePhonemicLevelsForSubject = (
  subject: PhonemicSubjectName | null | undefined,
  leftLevelName: unknown,
  leftPhonemicId: unknown,
  rightLevelName: unknown,
  rightPhonemicId: unknown,
): number => {
  const safeLeftId = Number.isFinite(Number(leftPhonemicId)) ? Number(leftPhonemicId) : Number.MAX_SAFE_INTEGER;
  const safeRightId = Number.isFinite(Number(rightPhonemicId)) ? Number(rightPhonemicId) : Number.MAX_SAFE_INTEGER;

  if (subject) {
    const rankByLevel = LEVEL_RANK_BY_SUBJECT[subject];
    const leftRank = rankByLevel.get(normalizePhonemicLevelName(leftLevelName));
    const rightRank = rankByLevel.get(normalizePhonemicLevelName(rightLevelName));

    if (leftRank !== undefined || rightRank !== undefined) {
      const safeLeftRank = leftRank ?? Number.MAX_SAFE_INTEGER;
      const safeRightRank = rightRank ?? Number.MAX_SAFE_INTEGER;
      if (safeLeftRank !== safeRightRank) {
        return safeLeftRank - safeRightRank;
      }
    }
  }

  const leftLabel = String(leftLevelName ?? "").trim();
  const rightLabel = String(rightLevelName ?? "").trim();
  const labelCompare = leftLabel.localeCompare(rightLabel);
  if (labelCompare !== 0) {
    return labelCompare;
  }

  return safeLeftId - safeRightId;
};
