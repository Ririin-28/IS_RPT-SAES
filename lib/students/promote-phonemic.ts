import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";

const ORDER_COLUMN_CANDIDATES = [
  "level_order",
  "sort_order",
  "order_index",
  "sequence",
  "position",
] as const;

export type SubjectName = "English" | "Filipino" | "Math";

export type PromotionTrend = "up" | "down" | "neutral";

export type PromotionReadinessStatus = "ready" | "not_ready" | "insufficient_data";

type PromotionLevel = {
  phonemic_id: number;
  level_name: string | null;
};

type PromotionLevelRow = RowDataPacket & {
  phonemic_id: number;
  level_name: string | null;
  level_order?: number | null;
};

type CurrentAssessmentRow = RowDataPacket & {
  assessment_id: number;
  phonemic_id: number;
  assessed_at: Date | string | null;
};

type PromotionContext = {
  assessmentId: number | null;
  phonemicId: number;
  assessedAt: Date | string | null;
};

type PromotionOptions = {
  currentLevelName?: string | null;
};

export type PromotionReadiness = {
  subject: SubjectName;
  status: PromotionReadinessStatus;
  trend: PromotionTrend;
  canPromote: boolean;
  threshold: number;
  requiredSessions: number;
  qualifyingStreak: number;
  recentAverages: number[];
  message: string;
};

export type PromotionResult = {
  currentLevel: PromotionLevel;
  nextLevel: PromotionLevel;
  recommendation: PromotionReadiness;
};

export const PROMOTION_AVERAGE_THRESHOLD = 85;
export const PROMOTION_REQUIRED_CONSECUTIVE_SESSIONS = 2;

const CANONICAL_LEVELS_BY_SUBJECT: Record<SubjectName, string[]> = {
  English: ["Non-Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"],
  Filipino: ["Non-Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"],
  Math: ["Not Proficient", "Low Proficient", "Nearly Proficient", "Proficient", "Highly Proficient"],
};

const normalizeLevelName = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const sortLevelsForSubject = (
  subject: SubjectName,
  levels: PromotionLevelRow[],
  orderColumn: string,
): PromotionLevelRow[] => {
  if (orderColumn !== "phonemic_id") {
    return levels;
  }

  const expectedLevels = CANONICAL_LEVELS_BY_SUBJECT[subject];
  if (!expectedLevels.length) {
    return levels;
  }

  const rankByLevel = new Map(
    expectedLevels.map((level, index) => [normalizeLevelName(level), index] as const),
  );

  return [...levels].sort((left, right) => {
    const leftRank = rankByLevel.get(normalizeLevelName(left.level_name));
    const rightRank = rankByLevel.get(normalizeLevelName(right.level_name));

    if (leftRank !== undefined || rightRank !== undefined) {
      const safeLeftRank = leftRank ?? Number.MAX_SAFE_INTEGER;
      const safeRightRank = rightRank ?? Number.MAX_SAFE_INTEGER;
      if (safeLeftRank !== safeRightRank) {
        return safeLeftRank - safeRightRank;
      }
    }

    return Number(left.phonemic_id) - Number(right.phonemic_id);
  });
};

const resolveSubjectId = async (subject: SubjectName): Promise<number> => {
  const [subjectRows] = await query<RowDataPacket[]>(
    "SELECT subject_id FROM subject WHERE LOWER(subject_name) = ?",
    [subject.toLowerCase()],
  );

  if (!subjectRows.length) {
    throw new Error("Subject not found.");
  }

  const subjectId = Number(subjectRows[0].subject_id);
  if (!Number.isFinite(subjectId)) {
    throw new Error("Subject not found.");
  }

  return subjectId;
};

const getLatestStudentAssessment = async (
  studentId: string,
  subjectId: number,
): Promise<CurrentAssessmentRow | null> => {
  const [currentRows] = await query<CurrentAssessmentRow[]>(
    `SELECT assessment_id, phonemic_id, assessed_at
     FROM student_subject_assessment
     WHERE student_id = ? AND subject_id = ?
     ORDER BY assessed_at DESC, assessment_id DESC
     LIMIT 1`,
    [studentId, subjectId],
  );

  if (!currentRows.length) {
    return null;
  }

  const currentAssessment = currentRows[0];
  const assessmentId = Number(currentAssessment.assessment_id);
  const currentPhonemicId = Number(currentAssessment.phonemic_id);

  if (!Number.isFinite(assessmentId) || !Number.isFinite(currentPhonemicId)) {
    throw new Error("Student does not have a valid phonemic level yet.");
  }

  return currentAssessment;
};

const resolveLevelIdByName = async (
  subjectId: number,
  currentLevelName?: string | null,
): Promise<number | null> => {
  const normalizedLevelName = String(currentLevelName ?? "").trim().toLowerCase();
  if (!normalizedLevelName) {
    return null;
  }

  const [rows] = await query<RowDataPacket[]>(
    `SELECT phonemic_id
     FROM phonemic_level
     WHERE subject_id = ? AND LOWER(TRIM(level_name)) = ?
     LIMIT 1`,
    [subjectId, normalizedLevelName],
  );

  if (!rows.length) {
    return null;
  }

  const phonemicId = Number(rows[0].phonemic_id);
  return Number.isFinite(phonemicId) ? phonemicId : null;
};

const getLatestPhonemicIdFromSessions = async (
  studentId: string,
  subjectId: number,
): Promise<number | null> => {
  const [rows] = await query<RowDataPacket[]>(
    `SELECT phonemic_id
     FROM student_remedial_session
     WHERE student_id = ?
       AND subject_id = ?
       AND phonemic_id IS NOT NULL
     ORDER BY COALESCE(completed_at, created_at) DESC, session_id DESC
     LIMIT 1`,
    [studentId, subjectId],
  );

  if (!rows.length) {
    return null;
  }

  const phonemicId = Number(rows[0].phonemic_id);
  return Number.isFinite(phonemicId) ? phonemicId : null;
};

const getLatestPhonemicIdFromHistory = async (
  studentId: string,
  subjectId: number,
): Promise<number | null> => {
  if (!(await tableExists("student_phonemic_history"))) {
    return null;
  }

  const [rows] = await query<RowDataPacket[]>(
    `SELECT phonemic_id
     FROM student_phonemic_history
     WHERE student_id = ?
       AND subject_id = ?
     ORDER BY achieved_at DESC, history_id DESC
     LIMIT 1`,
    [studentId, subjectId],
  );

  if (!rows.length) {
    return null;
  }

  const phonemicId = Number(rows[0].phonemic_id);
  return Number.isFinite(phonemicId) ? phonemicId : null;
};

const resolvePromotionContext = async (
  studentId: string,
  subjectId: number,
  options?: PromotionOptions,
): Promise<PromotionContext | null> => {
  const currentAssessment = await getLatestStudentAssessment(studentId, subjectId);
  if (currentAssessment) {
    return {
      assessmentId: Number(currentAssessment.assessment_id),
      phonemicId: Number(currentAssessment.phonemic_id),
      assessedAt: currentAssessment.assessed_at,
    };
  }

  const levelIdFromName = await resolveLevelIdByName(subjectId, options?.currentLevelName);
  if (levelIdFromName != null) {
    return {
      assessmentId: null,
      phonemicId: levelIdFromName,
      assessedAt: null,
    };
  }

  const levelIdFromSessions = await getLatestPhonemicIdFromSessions(studentId, subjectId);
  if (levelIdFromSessions != null) {
    return {
      assessmentId: null,
      phonemicId: levelIdFromSessions,
      assessedAt: null,
    };
  }

  const levelIdFromHistory = await getLatestPhonemicIdFromHistory(studentId, subjectId);
  if (levelIdFromHistory != null) {
    return {
      assessmentId: null,
      phonemicId: levelIdFromHistory,
      assessedAt: null,
    };
  }

  return null;
};

export async function getStudentPromotionReadiness(
  studentId: string,
  subject: SubjectName,
  options?: PromotionOptions,
): Promise<PromotionReadiness> {
  const requiredTables = ["student_remedial_session", "student_subject_assessment", "subject"];
  for (const table of requiredTables) {
    if (!(await tableExists(table))) {
      throw new Error(`Missing required table: ${table}`);
    }
  }

  const subjectId = await resolveSubjectId(subject);
  const context = await resolvePromotionContext(studentId, subjectId, options);

  if (!context) {
    return {
      subject,
      status: "insufficient_data",
      trend: "neutral",
      canPromote: false,
      threshold: PROMOTION_AVERAGE_THRESHOLD,
      requiredSessions: PROMOTION_REQUIRED_CONSECUTIVE_SESSIONS,
      qualifyingStreak: 0,
      recentAverages: [],
      message: "Current phonemic level is unavailable.",
    };
  }

  const currentPhonemicId = context.phonemicId;
  const assessedAt = context.assessedAt;

  const [sessionRows] = await query<RowDataPacket[]>(
    `SELECT overall_average
     FROM student_remedial_session
     WHERE student_id = ?
       AND subject_id = ?
       AND phonemic_id = ?
       AND overall_average IS NOT NULL
       AND (? IS NULL OR COALESCE(completed_at, created_at) > ?)
     ORDER BY COALESCE(completed_at, created_at) DESC, session_id DESC
     LIMIT ?`,
    [studentId, subjectId, currentPhonemicId, assessedAt, assessedAt, PROMOTION_REQUIRED_CONSECUTIVE_SESSIONS],
  );

  const recentAverages = (sessionRows ?? [])
    .map((row) => Number(row.overall_average))
    .filter((value) => Number.isFinite(value));

  let qualifyingStreak = 0;
  for (const average of recentAverages) {
    if (average >= PROMOTION_AVERAGE_THRESHOLD) {
      qualifyingStreak += 1;
      continue;
    }
    break;
  }

  if (recentAverages.length < PROMOTION_REQUIRED_CONSECUTIVE_SESSIONS) {
    return {
      subject,
      status: "insufficient_data",
      trend: "neutral",
      canPromote: false,
      threshold: PROMOTION_AVERAGE_THRESHOLD,
      requiredSessions: PROMOTION_REQUIRED_CONSECUTIVE_SESSIONS,
      qualifyingStreak,
      recentAverages,
      message: `Need ${PROMOTION_REQUIRED_CONSECUTIVE_SESSIONS} completed remedial sessions to evaluate promotion.`,
    };
  }

  if (qualifyingStreak >= PROMOTION_REQUIRED_CONSECUTIVE_SESSIONS) {
    return {
      subject,
      status: "ready",
      trend: "up",
      canPromote: true,
      threshold: PROMOTION_AVERAGE_THRESHOLD,
      requiredSessions: PROMOTION_REQUIRED_CONSECUTIVE_SESSIONS,
      qualifyingStreak,
      recentAverages,
      message: `Ready to promote: the last ${PROMOTION_REQUIRED_CONSECUTIVE_SESSIONS} session averages are ${PROMOTION_AVERAGE_THRESHOLD}% or higher.`,
    };
  }

  return {
    subject,
    status: "not_ready",
    trend: "down",
    canPromote: false,
    threshold: PROMOTION_AVERAGE_THRESHOLD,
    requiredSessions: PROMOTION_REQUIRED_CONSECUTIVE_SESSIONS,
    qualifyingStreak,
    recentAverages,
    message: `Not ready yet: the student needs ${PROMOTION_REQUIRED_CONSECUTIVE_SESSIONS} straight session averages of ${PROMOTION_AVERAGE_THRESHOLD}% or higher.`,
  };
}

export async function promoteStudentPhonemic(
  studentId: string,
  subject: SubjectName,
  options?: PromotionOptions,
): Promise<PromotionResult> {
  const requiredTables = ["student_subject_assessment", "phonemic_level", "subject"];
  for (const table of requiredTables) {
    if (!(await tableExists(table))) {
      throw new Error(`Missing required table: ${table}`);
    }
  }

  const subjectId = await resolveSubjectId(subject);

  const phonemicColumns = await getTableColumns("phonemic_level");
  const orderColumn = ORDER_COLUMN_CANDIDATES.find((column) => phonemicColumns.has(column)) ?? "phonemic_id";

  const [rawLevels] = await query<PromotionLevelRow[]>(
    `SELECT phonemic_id, level_name, ${orderColumn} AS level_order
     FROM phonemic_level
     WHERE subject_id = ?
     ORDER BY ${orderColumn} ASC, phonemic_id ASC`,
    [subjectId],
  );

  const levels = sortLevelsForSubject(subject, rawLevels, orderColumn);

  if (!levels.length) {
    throw new Error("No phonemic levels configured for this subject.");
  }

  const context = await resolvePromotionContext(studentId, subjectId, options);
  if (!context) {
    throw new Error("Current phonemic level is unavailable for promotion.");
  }

  const assessmentId = context.assessmentId;
  const currentPhonemicId = context.phonemicId;

  const currentIndex = levels.findIndex(
    (level) => Number(level.phonemic_id) === currentPhonemicId,
  );

  if (currentIndex < 0) {
    throw new Error("Current phonemic level not found for this subject.");
  }

  if (currentIndex >= levels.length - 1) {
    throw new Error("Student is already at the highest level.");
  }

  const currentLevel = levels[currentIndex];
  const nextLevel = levels[currentIndex + 1];
  const recommendation = await getStudentPromotionReadiness(studentId, subject, options);

  if (!recommendation.canPromote) {
    throw new Error(recommendation.message);
  }

  if (assessmentId != null) {
    await query(
      "UPDATE student_subject_assessment SET phonemic_id = ?, assessed_at = NOW() WHERE assessment_id = ?",
      [Number(nextLevel.phonemic_id), assessmentId],
    );
  } else {
    await query(
      `INSERT INTO student_subject_assessment (student_id, subject_id, phonemic_id, assessed_at)
       VALUES (?, ?, ?, NOW())`,
      [studentId, subjectId, Number(nextLevel.phonemic_id)],
    );
  }

  return {
    currentLevel: {
      phonemic_id: Number(currentLevel.phonemic_id),
      level_name: typeof currentLevel.level_name === "string" ? currentLevel.level_name : null,
    },
    nextLevel: {
      phonemic_id: Number(nextLevel.phonemic_id),
      level_name: typeof nextLevel.level_name === "string" ? nextLevel.level_name : null,
    },
    recommendation,
  };
}
