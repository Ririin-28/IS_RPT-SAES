import { getTableColumns, query } from "@/lib/db";
import { ensurePerformanceSchema } from "./schema";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

export type ActivityType = 'remedial' | 'academic' | 'flashcard' | 'quiz' | 'other';

export interface CreateActivityInput {
  type: ActivityType;
  subject: string;
  title: string;
  description?: string;
  date: Date;
}

export interface PerformanceRecordInput {
  studentId: string;
  activityId: number;
  score: number;
  totalItems: number;
  grade?: string;
  metadata?: any;
  remarks?: string;
  teacherNotes?: string;
  completedAt?: Date;
}

export async function createActivity(input: CreateActivityInput): Promise<number> {
  await ensurePerformanceSchema();
  const { type, subject, title, description, date } = input;
  const [result] = await query<ResultSetHeader>(
    `INSERT INTO activities (type, subject, title, description, date) VALUES (?, ?, ?, ?, ?)`,
    [type, subject, title, description ?? null, date]
  );
  return result.insertId;
}

export async function recordPerformance(input: PerformanceRecordInput): Promise<number> {
  await ensurePerformanceSchema();
  const { studentId, activityId, score, totalItems, grade, metadata, remarks, teacherNotes, completedAt } = input;
  
  const [result] = await query<ResultSetHeader>(
    `INSERT INTO performance_records (student_id, activity_id, score, total_items, grade, metadata, completed_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [studentId, activityId, score, totalItems, grade ?? null, JSON.stringify(metadata ?? {}), completedAt ?? new Date()]
  );
  
  const recordId = result.insertId;

  if (remarks || teacherNotes) {
    await query(
      `INSERT INTO remarks (performance_record_id, content, teacher_notes) VALUES (?, ?, ?)`,
      [recordId, remarks ?? "", teacherNotes ?? null]
    );
  }

  return recordId;
}

export async function getStudentPerformance(studentId: string, options?: { subject?: string, startDate?: Date, endDate?: Date }) {
  await ensurePerformanceSchema();
  let sql = `
    SELECT 
      pr.*, 
      a.title as activity_title, 
      a.type as activity_type, 
      a.subject as activity_subject, 
      a.date as activity_date,
      r.content as remark_content,
      r.teacher_notes
    FROM performance_records pr
    JOIN activities a ON pr.activity_id = a.activity_id
    LEFT JOIN remarks r ON pr.record_id = r.performance_record_id
    WHERE pr.student_id = ?
  `;
  
  const params: any[] = [studentId];

  if (options?.subject) {
    sql += ` AND a.subject = ?`;
    params.push(options.subject);
  }

  if (options?.startDate) {
    sql += ` AND a.date >= ?`;
    params.push(options.startDate);
  }

  if (options?.endDate) {
    sql += ` AND a.date <= ?`;
    params.push(options.endDate);
  }

  sql += ` ORDER BY a.date DESC`;

  const [rows] = await query<RowDataPacket[]>(sql, params);
  return rows;
}

export async function getActivityPerformance(activityId: number) {
  await ensurePerformanceSchema();
  const sql = `
    SELECT 
      pr.*, 
      s.first_name, s.last_name, s.middle_name, s.lrn,
      r.content as remark_content,
      r.teacher_notes
    FROM performance_records pr
    JOIN student s ON pr.student_id = s.student_id
    LEFT JOIN remarks r ON pr.record_id = r.performance_record_id
    WHERE pr.activity_id = ?
    ORDER BY pr.score DESC
  `;
  const [rows] = await query<RowDataPacket[]>(sql, [activityId]);
  return rows;
}

export async function getStudentDetails(studentId: string) {
  await ensurePerformanceSchema();
  const [rows] = await query<RowDataPacket[]>(
    `SELECT * FROM student WHERE student_id = ?`,
    [studentId]
  );
  return rows[0] || null;
}

export type RemedialSessionSlide = {
  performance_id?: number | string | null;
  session_id?: number | string | null;
  flashcard_index?: number | null;
  expected_text?: string | null;
  transcription?: string | null;
  pronunciation_score?: number | null;
  correctness_score?: number | null;
  reading_speed_wpm?: number | null;
  slide_average?: number | null;
  created_at?: string | Date | null;
};

export type RemedialSessionTimelineItem = {
  session_id?: number | string | null;
  student_id?: string | null;
  approved_schedule_id?: number | null;
  subject_id?: number | null;
  grade_id?: number | null;
  phonemic_id?: number | null;
  material_id?: number | null;
  overall_average?: number | null;
  ai_remarks?: string | null;
  completed_at?: string | Date | null;
  created_at?: string | Date | null;
  schedule_title?: string | null;
  schedule_date?: string | Date | null;
  phonemic_level?: string | null;
  slides: RemedialSessionSlide[];
};

const APPROVED_REMEDIAL_TABLE = "approved_remedial_schedule";
const PHONEMIC_LEVEL_TABLE = "phonemic_level";
const APPROVED_ID_COLUMN_CANDIDATES = ["request_id", "activity_id", "id"] as const;
const APPROVED_TITLE_COLUMN_CANDIDATES = ["title", "activity_title", "name"] as const;
const APPROVED_DATE_COLUMN_CANDIDATES = ["schedule_date", "activity_date", "date"] as const;

const pickColumn = (columns: Set<string>, candidates: readonly string[]) => {
  for (const candidate of candidates) {
    if (columns.has(candidate)) return candidate;
  }
  return null;
};

const normalizeSubjectLabel = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower === "mathematics" || lower === "math") return "Math";
  if (lower === "english") return "English";
  if (lower === "filipino") return "Filipino";
  return trimmed;
};

const toNumberValue = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveSubjectIdByName = async (subjectName: string): Promise<number | null> => {
  const normalized = normalizeSubjectLabel(subjectName);
  const fallbackMap: Record<string, number> = { English: 1, Filipino: 2, Math: 3 };
  const fallback = fallbackMap[normalized];
  const columns = await getTableColumns("subject");
  if (!columns.size || !columns.has("subject_id")) {
    return fallback ?? null;
  }

  const nameColumn = columns.has("subject_name")
    ? "subject_name"
    : columns.has("name")
      ? "name"
      : columns.has("subject")
        ? "subject"
        : null;

  if (!nameColumn) {
    return fallback ?? null;
  }

  const [rows] = await query<RowDataPacket[]>(
    `SELECT subject_id FROM subject WHERE LOWER(TRIM(${nameColumn})) = LOWER(TRIM(?)) LIMIT 1`,
    [normalized],
  );
  const id = Number(rows[0]?.subject_id);
  return Number.isFinite(id) ? id : (fallback ?? null);
};

export async function getRemedialSessionTimeline(
  studentId: string,
  options?: { subjectName?: string | null },
): Promise<RemedialSessionTimelineItem[]> {
  const subjectName = options?.subjectName?.trim() ?? "";
  const subjectId = subjectName ? await resolveSubjectIdByName(subjectName) : null;

  let sessionSql = `
    SELECT
      session_id,
      student_id,
      approved_schedule_id,
      subject_id,
      grade_id,
      phonemic_id,
      material_id,
      overall_average,
      ai_remarks,
      completed_at,
      created_at
    FROM student_remedial_session
    WHERE student_id = ?
  `;

  const params: Array<string | number | null> = [studentId];
  if (subjectId) {
    sessionSql += ` AND subject_id = ?`;
    params.push(subjectId);
  }
  sessionSql += ` ORDER BY COALESCE(completed_at, created_at) DESC`;

  const [sessionRows] = await query<RowDataPacket[]>(sessionSql, params);
  const sessions = (sessionRows ?? []).map((row) => ({
    session_id: row.session_id ?? null,
    student_id: row.student_id ?? null,
    approved_schedule_id: row.approved_schedule_id ?? null,
    subject_id: row.subject_id ?? null,
    grade_id: row.grade_id ?? null,
    phonemic_id: row.phonemic_id ?? null,
    material_id: row.material_id ?? null,
    overall_average: toNumberValue(row.overall_average),
    ai_remarks: row.ai_remarks ?? null,
    completed_at: row.completed_at ?? null,
    created_at: row.created_at ?? null,
    schedule_title: null,
    schedule_date: null,
    phonemic_level: null,
    slides: [] as RemedialSessionSlide[],
  }));

  if (!sessions.length) {
    return [];
  }

  const approvedIds = sessions
    .map((item) => Number(item.approved_schedule_id))
    .filter((value) => Number.isFinite(value));

  if (approvedIds.length) {
    const approvedColumns = await getTableColumns(APPROVED_REMEDIAL_TABLE);
    const idColumn = pickColumn(approvedColumns, APPROVED_ID_COLUMN_CANDIDATES);
    const titleColumn = pickColumn(approvedColumns, APPROVED_TITLE_COLUMN_CANDIDATES);
    const dateColumn = pickColumn(approvedColumns, APPROVED_DATE_COLUMN_CANDIDATES);

    if (idColumn && (titleColumn || dateColumn)) {
      const placeholders = approvedIds.map(() => "?").join(", ");
      const selectParts = [
        `${idColumn} AS schedule_id`,
        titleColumn ? `${titleColumn} AS schedule_title` : "NULL AS schedule_title",
        dateColumn ? `${dateColumn} AS schedule_date` : "NULL AS schedule_date",
      ];

      const [approvedRows] = await query<RowDataPacket[]>(
        `SELECT ${selectParts.join(", ")}
         FROM ${APPROVED_REMEDIAL_TABLE}
         WHERE ${idColumn} IN (${placeholders})`,
        approvedIds,
      );

      const scheduleById = new Map<number, { title: string | null; date: string | Date | null }>();
      for (const row of approvedRows ?? []) {
        const scheduleId = Number(row.schedule_id);
        if (!Number.isFinite(scheduleId)) continue;
        scheduleById.set(scheduleId, {
          title: row.schedule_title ?? null,
          date: row.schedule_date ?? null,
        });
      }

      for (const session of sessions) {
        const scheduleId = Number(session.approved_schedule_id);
        if (!Number.isFinite(scheduleId)) continue;
        const schedule = scheduleById.get(scheduleId);
        if (!schedule) continue;
        session.schedule_title = schedule.title ?? null;
        session.schedule_date = schedule.date ?? null;
      }
    }
  }

  const phonemicIds = sessions
    .map((item) => Number(item.phonemic_id))
    .filter((value) => Number.isFinite(value));

  if (phonemicIds.length) {
    const phonemicColumns = await getTableColumns(PHONEMIC_LEVEL_TABLE);
    if (phonemicColumns.has("phonemic_id") && phonemicColumns.has("level_name")) {
      const placeholders = phonemicIds.map(() => "?").join(", ");
      const [phonemicRows] = await query<RowDataPacket[]>(
        `SELECT phonemic_id, level_name
         FROM ${PHONEMIC_LEVEL_TABLE}
         WHERE phonemic_id IN (${placeholders})`,
        phonemicIds,
      );

      const levelById = new Map<number, string>();
      for (const row of phonemicRows ?? []) {
        const pid = Number(row.phonemic_id);
        const levelName = typeof row.level_name === "string" ? row.level_name.trim() : "";
        if (!Number.isFinite(pid) || !levelName) continue;
        levelById.set(pid, levelName);
      }

      for (const session of sessions) {
        const pid = Number(session.phonemic_id);
        if (!Number.isFinite(pid)) continue;
        session.phonemic_level = levelById.get(pid) ?? null;
      }
    }
  }

  const sessionIds = sessions
    .map((item) => Number(item.session_id))
    .filter((value) => Number.isFinite(value));

  if (!sessionIds.length) {
    return sessions;
  }

  const placeholders = sessionIds.map(() => "?").join(", ");
  const [slideRows] = await query<RowDataPacket[]>(
    `SELECT
      performance_id,
      session_id,
      flashcard_index,
      expected_text,
      transcription,
      pronunciation_score,
      correctness_score,
      reading_speed_wpm,
      slide_average,
      created_at
     FROM student_remedial_flashcard_performance
     WHERE session_id IN (${placeholders})
     ORDER BY session_id DESC, flashcard_index ASC, created_at ASC`,
    sessionIds,
  );

  const slidesBySession = new Map<number, RemedialSessionSlide[]>();
  for (const row of slideRows ?? []) {
    const sid = Number(row.session_id);
    if (!Number.isFinite(sid)) continue;
    const entry: RemedialSessionSlide = {
      performance_id: row.performance_id ?? null,
      session_id: row.session_id ?? null,
      flashcard_index: row.flashcard_index ?? null,
      expected_text: row.expected_text ?? null,
      transcription: row.transcription ?? null,
      pronunciation_score: toNumberValue(row.pronunciation_score),
      correctness_score: toNumberValue(row.correctness_score),
      reading_speed_wpm: toNumberValue(row.reading_speed_wpm),
      slide_average: toNumberValue(row.slide_average),
      created_at: row.created_at ?? null,
    };
    if (!slidesBySession.has(sid)) {
      slidesBySession.set(sid, []);
    }
    slidesBySession.get(sid)!.push(entry);
  }

  return sessions.map((session) => {
    const sid = Number(session.session_id);
    return {
      ...session,
      slides: Number.isFinite(sid) ? slidesBySession.get(sid) ?? [] : [],
    };
  });
}


export async function getPerformanceSummary(options?: { 
  studentId?: string, 
  subject?: string, 
  type?: ActivityType,
  startDate?: Date, 
  endDate?: Date,
  grade?: string
}) {
  await ensurePerformanceSchema();
  let sql = `
    SELECT 
      pr.*, 
      a.title as activity_title, 
      a.type as activity_type, 
      a.subject as activity_subject, 
      a.date as activity_date,
      s.first_name, s.last_name,
      r.content as remark_content
    FROM performance_records pr
    JOIN activities a ON pr.activity_id = a.activity_id
    JOIN student s ON pr.student_id = s.student_id
    LEFT JOIN remarks r ON pr.record_id = r.performance_record_id
    WHERE 1=1
  `;
  
  const params: any[] = [];

  if (options?.studentId) {
    sql += ` AND pr.student_id = ?`;
    params.push(options.studentId);
  }

  if (options?.subject) {
    sql += ` AND a.subject = ?`;
    params.push(options.subject);
  }

  if (options?.type) {
    sql += ` AND a.type = ?`;
    params.push(options.type);
  }

  if (options?.grade) {
    sql += ` AND pr.grade = ?`;
    params.push(options.grade);
  }

  if (options?.startDate) {
    sql += ` AND a.date >= ?`;
    params.push(options.startDate);
  }

  if (options?.endDate) {
    sql += ` AND a.date <= ?`;
    params.push(options.endDate);
  }

  sql += ` ORDER BY a.date DESC`;

  const [rows] = await query<RowDataPacket[]>(sql, params);
  return rows;
}
