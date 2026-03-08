import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";

export const dynamic = "force-dynamic";

type AiWeakSkillPoint = { skill: string; gap: number };
type InterventionPoint = { name: string; predicted: number };
type ForecastPoint = { point: string; actual: number | null; forecast: number | null };

const SUBJECT_TABLE = "subject";
const GRADE_TABLE = "grade";
const APPROVED_SCHEDULE_TABLE = "approved_remedial_schedule";
const CONTENT_TABLE = "remedial_material_content";
const SESSION_TABLE = "student_remedial_session";

const SKILL_KEYWORDS: Array<{ skill: string; terms: string[] }> = [
  { skill: "Phonemic Awareness", terms: ["phonemic", "segment", "blend", "syllable", "sound"] },
  { skill: "Reading Fluency", terms: ["fluency", "pace", "smooth", "automaticity", "expression"] },
  { skill: "Comprehension", terms: ["comprehension", "infer", "context", "understand", "meaning"] },
  { skill: "Vocabulary", terms: ["vocabulary", "word meaning", "context clue", "word bank"] },
  { skill: "Math Fact Recall", terms: ["math", "number", "computation", "arithmetic", "problem solving"] },
  { skill: "Pronunciation Accuracy", terms: ["pronunciation", "accuracy", "articulation", "enunciation"] },
];

const INTERVENTIONS = ["Small Group", "1:1 Coaching", "Targeted Flashcards", "Home Practice"];

const toDateInput = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^\d{4}-\d{2}-\d{2}$/);
  return match ? match[0] : null;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

function extractGradeNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(\d+)/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function resolveSubjectId(subject: string): Promise<number | null> {
  const columns = await getTableColumns(SUBJECT_TABLE);
  if (!columns.size || !columns.has("subject_id")) return null;
  const nameColumn = columns.has("subject_name") ? "subject_name" : columns.has("name") ? "name" : null;
  if (!nameColumn) return null;
  const [rows] = await query<RowDataPacket[]>(
    `SELECT subject_id FROM \`${SUBJECT_TABLE}\` WHERE LOWER(TRIM(${nameColumn})) = LOWER(TRIM(?)) LIMIT 1`,
    [subject],
  );
  const raw = rows?.[0]?.subject_id;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

async function resolveGradeIds(gradeValue: string): Promise<number[]> {
  const gradeNumber = extractGradeNumber(gradeValue);
  if (gradeNumber === null) return [];
  const columns = await getTableColumns(GRADE_TABLE);
  if (!columns.size || !columns.has("grade_id")) return [gradeNumber];
  const labelColumn = columns.has("grade_level") ? "grade_level" : columns.has("grade") ? "grade" : null;
  if (!labelColumn) return [gradeNumber];

  const [rows] = await query<RowDataPacket[]>(
    `SELECT DISTINCT grade_id FROM \`${GRADE_TABLE}\` WHERE grade_id = ? OR CAST(${labelColumn} AS CHAR) LIKE ?`,
    [gradeNumber, `%${gradeNumber}%`],
  );
  const ids = (rows ?? [])
    .map((row) => Number(row.grade_id))
    .filter((id): id is number => Number.isFinite(id));
  return ids.length ? ids : [gradeNumber];
}

const parseJson = (value: unknown): unknown => {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const flattenToText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => flattenToText(item)).join(" ");
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map((item) => flattenToText(item)).join(" ");
  }
  return String(value);
};

function countKeywordHits(text: string): Map<string, number> {
  const source = text.toLowerCase();
  const result = new Map<string, number>();
  for (const { skill, terms } of SKILL_KEYWORDS) {
    let hits = 0;
    for (const term of terms) {
      const matches = source.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"));
      hits += matches?.length ?? 0;
    }
    result.set(skill, hits);
  }
  return result;
}

function buildForecast(points: Array<{ date: Date; score: number }>): ForecastPoint[] {
  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  const reduced = sorted.slice(-8);
  if (!reduced.length) {
    return Array.from({ length: 12 }, (_, index) => ({
      point: `W${index + 1}`,
      actual: index < 8 ? 52 + index * 2 : null,
      forecast: index >= 8 ? 68 + (index - 8) * 2 : null,
    }));
  }

  const actual = reduced.map((entry, index) => ({
    point: `W${index + 1}`,
    actual: Number(entry.score.toFixed(1)),
    forecast: null,
  }));

  const first = reduced[0].score;
  const last = reduced[reduced.length - 1].score;
  const slope = reduced.length > 1 ? (last - first) / (reduced.length - 1) : 1.5;
  const base = last;

  const forecast = Array.from({ length: 4 }, (_, index) => ({
    point: `W${reduced.length + index + 1}`,
    actual: null,
    forecast: Number(clamp(base + slope * (index + 1), 20, 99).toFixed(1)),
  }));

  return [...actual, ...forecast];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      subject?: string;
      grade?: string;
      studentIds?: Array<string | number>;
      from?: string | null;
      to?: string | null;
    } | null;

    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const grade = typeof body?.grade === "string" ? body.grade.trim() : "";
    const from = toDateInput(body?.from ?? null);
    const to = toDateInput(body?.to ?? null);
    const studentIds = Array.isArray(body?.studentIds)
      ? body!.studentIds
          .map((id) => String(id).trim())
          .filter((id) => id.length > 0)
      : [];

    if (!subject || !grade || !studentIds.length) {
      return NextResponse.json(
        {
          success: true,
          data: {
            weakSkills: [] as AiWeakSkillPoint[],
            interventionPrediction: [] as InterventionPoint[],
            progressForecast: [] as ForecastPoint[],
            metadata: { sessions: 0, materials: 0, flashcards: 0 },
          },
        },
        { status: 200 },
      );
    }

    const [subjectId, gradeIds, hasSchedule, hasContent, hasSession] = await Promise.all([
      resolveSubjectId(subject),
      resolveGradeIds(grade),
      tableExists(APPROVED_SCHEDULE_TABLE),
      tableExists(CONTENT_TABLE),
      tableExists(SESSION_TABLE),
    ]);

    if (!subjectId || !gradeIds.length || !hasSession) {
      return NextResponse.json(
        {
          success: true,
          data: {
            weakSkills: [] as AiWeakSkillPoint[],
            interventionPrediction: [] as InterventionPoint[],
            progressForecast: [] as ForecastPoint[],
            metadata: { sessions: 0, materials: 0, flashcards: 0 },
          },
        },
        { status: 200 },
      );
    }

    const sessionColumns = await getTableColumns(SESSION_TABLE);
    const sessionDateColumn = sessionColumns.has("completed_at")
      ? "completed_at"
      : sessionColumns.has("created_at")
        ? "created_at"
        : null;

    const sessionWhere: string[] = [];
    const sessionParams: Array<string | number> = [];
    sessionWhere.push(`subject_id = ?`);
    sessionParams.push(subjectId);
    sessionWhere.push(`grade_id IN (${gradeIds.map(() => "?").join(", ")})`);
    sessionParams.push(...gradeIds);
    sessionWhere.push(`student_id IN (${studentIds.map(() => "?").join(", ")})`);
    sessionParams.push(...studentIds);
    if (sessionDateColumn && from) {
      sessionWhere.push(`DATE(${sessionDateColumn}) >= ?`);
      sessionParams.push(from);
    }
    if (sessionDateColumn && to) {
      sessionWhere.push(`DATE(${sessionDateColumn}) <= ?`);
      sessionParams.push(to);
    }

    const [sessionRows] = await query<RowDataPacket[]>(
      `SELECT session_id, overall_average, ai_remarks, ${sessionDateColumn ?? "NULL"} AS event_date
       FROM \`${SESSION_TABLE}\`
       WHERE ${sessionWhere.join(" AND ")}
       ORDER BY ${sessionDateColumn ?? "session_id"} DESC
       LIMIT 800`,
      sessionParams,
    );

    let scheduleIds: number[] = [];
    if (hasSchedule) {
      const scheduleColumns = await getTableColumns(APPROVED_SCHEDULE_TABLE);
      if (scheduleColumns.has("request_id") && scheduleColumns.has("subject_id") && scheduleColumns.has("grade_id")) {
        const parts: string[] = ["subject_id = ?", `grade_id IN (${gradeIds.map(() => "?").join(", ")})`];
        const params: Array<string | number> = [subjectId, ...gradeIds];
        if (from && scheduleColumns.has("schedule_date")) {
          parts.push("DATE(schedule_date) >= ?");
          params.push(from);
        }
        if (to && scheduleColumns.has("schedule_date")) {
          parts.push("DATE(schedule_date) <= ?");
          params.push(to);
        }
        const [rows] = await query<RowDataPacket[]>(
          `SELECT request_id FROM \`${APPROVED_SCHEDULE_TABLE}\` WHERE ${parts.join(" AND ")} ORDER BY request_id DESC LIMIT 600`,
          params,
        );
        scheduleIds = (rows ?? [])
          .map((row) => Number(row.request_id))
          .filter((value): value is number => Number.isFinite(value));
      }
    }

    let contentText = "";
    let materialCount = 0;
    let flashcardCount = 0;

    if (hasContent && scheduleIds.length) {
      const contentColumns = await getTableColumns(CONTENT_TABLE);
      const where = [`request_id IN (${scheduleIds.map(() => "?").join(", ")})`];
      const params: Array<string | number> = [...scheduleIds];
      if (from && contentColumns.has("updated_at")) {
        where.push("DATE(updated_at) >= ?");
        params.push(from);
      }
      if (to && contentColumns.has("updated_at")) {
        where.push("DATE(updated_at) <= ?");
        params.push(to);
      }

      const [contentRows] = await query<RowDataPacket[]>(
        `SELECT material_id, flashcards_json, flashcards_override_json, extracted_slides_json
         FROM \`${CONTENT_TABLE}\`
         WHERE ${where.join(" AND ")}
         ORDER BY updated_at DESC
         LIMIT 600`,
        params,
      );

      materialCount = contentRows.length;
      for (const row of contentRows) {
        const flashcards = parseJson(row.flashcards_override_json) ?? parseJson(row.flashcards_json);
        if (Array.isArray(flashcards)) {
          flashcardCount += flashcards.length;
        }
        const slides = parseJson(row.extracted_slides_json);
        contentText += ` ${flattenToText(flashcards)} ${flattenToText(slides)}`;
      }
    }

    const aiText = (sessionRows ?? [])
      .map((row) => (typeof row.ai_remarks === "string" ? row.ai_remarks : ""))
      .join(" ");
    const aiHits = countKeywordHits(aiText);
    const contentHits = countKeywordHits(contentText);

    const avgScoreRaw =
      sessionRows.length > 0
        ? sessionRows.reduce((sum, row) => sum + (Number(row.overall_average) || 0), 0) / sessionRows.length
        : 0;
    const avgScore = clamp(avgScoreRaw || 55, 25, 98);

    const weakSkills: AiWeakSkillPoint[] = SKILL_KEYWORDS.map(({ skill }) => {
      const totalHits = (aiHits.get(skill) ?? 0) * 2 + (contentHits.get(skill) ?? 0);
      const gap = clamp(Math.round(36 + totalHits * 6 + (70 - avgScore) * 0.5), 12, 92);
      return { skill, gap };
    })
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 5);

    const interventionPrediction: InterventionPoint[] = INTERVENTIONS.map((name, index) => {
      const hitPenalty = weakSkills[index % Math.max(weakSkills.length, 1)]?.gap ?? 24;
      const predicted = clamp(
        Math.round(72 + avgScore * 0.2 - hitPenalty * 0.25 + materialCount * 0.15 + flashcardCount * 0.03 - index * 2),
        35,
        98,
      );
      return { name, predicted };
    });

    const scorePoints = sessionRows
      .map((row) => {
        const date = new Date(row.event_date);
        const score = Number(row.overall_average);
        if (Number.isNaN(date.getTime()) || !Number.isFinite(score)) return null;
        return { date, score: clamp(score, 0, 100) };
      })
      .filter((value): value is { date: Date; score: number } => Boolean(value));

    const progressForecast = buildForecast(scorePoints);

    return NextResponse.json({
      success: true,
      data: {
        weakSkills,
        interventionPrediction,
        progressForecast,
        metadata: {
          sessions: sessionRows.length,
          materials: materialCount,
          flashcards: flashcardCount,
          averageScore: Number(avgScore.toFixed(1)),
        },
      },
    });
  } catch (error) {
    console.error("Failed to load coordinator AI insights", error);
    return NextResponse.json({ success: false, error: "Failed to load AI insights." }, { status: 500 });
  }
}
