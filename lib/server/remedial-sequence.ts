import type { RowDataPacket } from "mysql2/promise";
import { formatScheduleDateLabel } from "@/lib/remedial-schedule";

type QueryParams = Array<string | number | null | undefined | Date>;

type QueryExecutor = {
  query<T extends RowDataPacket[]>(sql: string, params?: QueryParams): Promise<[T, unknown]>;
};

type ScheduleRow = RowDataPacket & {
  request_id?: number | string | null;
  subject_id?: number | string | null;
  grade_id?: number | string | null;
  schedule_date?: string | Date | null;
};

type CompletionRow = RowDataPacket & {
  student_id?: string | number | null;
  approved_schedule_id?: number | string | null;
  is_completed?: number | boolean | null;
};

export type PriorScheduleBlock = {
  scheduleId: number;
  scheduleDate: string | Date | null;
  message: string;
};

const toNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toStudentId = (value: number | string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

export function buildPriorScheduleMessage(previousScheduleDate: string | Date | null, currentScheduleDate: string | Date | null): string {
  const previousLabel = formatScheduleDateLabel(previousScheduleDate);
  const currentLabel = formatScheduleDateLabel(currentScheduleDate);

  if (previousLabel && currentLabel) {
    return `This student must complete the ${previousLabel} remedial schedule before starting the ${currentLabel} session.`;
  }

  if (previousLabel) {
    return `This student must complete the ${previousLabel} remedial schedule before starting this session.`;
  }

  return "This student must complete the earlier remedial schedule before starting this session.";
}

export async function getPriorScheduleBlocksByStudent(
  executor: QueryExecutor,
  approvedScheduleId: number,
  studentIds: string[],
): Promise<Record<string, PriorScheduleBlock | null>> {
  const blocksByStudent: Record<string, PriorScheduleBlock | null> = {};
  for (const studentId of studentIds) {
    blocksByStudent[studentId] = null;
  }

  if (!approvedScheduleId || !studentIds.length) {
    return blocksByStudent;
  }

  const [currentRows] = await executor.query<ScheduleRow[]>(
    `SELECT request_id, subject_id, grade_id, schedule_date
     FROM approved_remedial_schedule
     WHERE request_id = ?
     LIMIT 1`,
    [approvedScheduleId],
  );

  if (!currentRows.length) {
    return blocksByStudent;
  }

  const currentScheduleId = toNumber(currentRows[0].request_id);
  const subjectId = toNumber(currentRows[0].subject_id);
  const gradeId = toNumber(currentRows[0].grade_id);
  const currentScheduleDate = currentRows[0].schedule_date ?? null;

  if (!currentScheduleId || !subjectId || !gradeId || !currentScheduleDate) {
    return blocksByStudent;
  }

  const [priorScheduleRows] = await executor.query<ScheduleRow[]>(
    `SELECT request_id, schedule_date
     FROM approved_remedial_schedule
     WHERE subject_id = ?
       AND grade_id = ?
       AND (
         schedule_date < ?
         OR (schedule_date = ? AND request_id < ?)
       )
     ORDER BY schedule_date ASC, request_id ASC`,
    [subjectId, gradeId, currentScheduleDate, currentScheduleDate, currentScheduleId],
  );

  if (!priorScheduleRows.length) {
    return blocksByStudent;
  }

  const priorSchedules = priorScheduleRows
    .map((row) => ({
      scheduleId: toNumber(row.request_id),
      scheduleDate: row.schedule_date ?? null,
    }))
    .filter((row): row is { scheduleId: number; scheduleDate: string | Date | null } => Boolean(row.scheduleId));

  if (!priorSchedules.length) {
    return blocksByStudent;
  }

  const scheduleIds = priorSchedules.map((row) => row.scheduleId);
  const studentPlaceholders = studentIds.map(() => "?").join(", ");
  const schedulePlaceholders = scheduleIds.map(() => "?").join(", ");
  const [completionRows] = await executor.query<CompletionRow[]>(
    `SELECT
       s.student_id,
       s.approved_schedule_id,
       MAX(CASE WHEN p.session_id IS NOT NULL AND s.completed_at IS NOT NULL THEN 1 ELSE 0 END) AS is_completed
     FROM student_remedial_session s
     LEFT JOIN student_remedial_flashcard_performance p
       ON p.session_id = s.session_id
     WHERE s.student_id IN (${studentPlaceholders})
       AND s.approved_schedule_id IN (${schedulePlaceholders})
     GROUP BY s.student_id, s.approved_schedule_id`,
    [...studentIds, ...scheduleIds],
  );

  const completionKey = new Set<string>();
  for (const row of completionRows) {
    const studentId = toStudentId(row.student_id);
    const scheduleId = toNumber(row.approved_schedule_id);
    const completed = Boolean(Number(row.is_completed ?? 0));
    if (!studentId || !scheduleId || !completed) {
      continue;
    }
    completionKey.add(`${studentId}:${scheduleId}`);
  }

  for (const studentId of studentIds) {
    for (const schedule of priorSchedules) {
      if (completionKey.has(`${studentId}:${schedule.scheduleId}`)) {
        continue;
      }

      blocksByStudent[studentId] = {
        scheduleId: schedule.scheduleId,
        scheduleDate: schedule.scheduleDate,
        message: buildPriorScheduleMessage(schedule.scheduleDate, currentScheduleDate),
      };
      break;
    }
  }

  return blocksByStudent;
}
