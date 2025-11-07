import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";

export const dynamic = "force-dynamic";

const SUBJECT_SCHEDULE_TABLE = "subject_schedule";
const ID_COLUMN_CANDIDATES = ["id", "schedule_id", "subject_schedule_id"] as const;
const DAY_COLUMN_MAP = {
  Monday: "monday_subject",
  Tuesday: "tuesday_subject",
  Wednesday: "wednesday_subject",
  Thursday: "thursday_subject",
  Friday: "friday_subject",
} as const;

const DEFAULT_SUBJECT_OPTIONS = [
  "English",
  "Filipino",
  "Math",
  "Science",
  "Araling Panlipunan",
  "MAPEH",
  "Values Education",
  "Assessment",
];

type SubjectScheduleRow = RowDataPacket & {
  id?: number | null;
  schedule_id?: number | null;
  subject_schedule_id?: number | null;
  monday_subject?: string | null;
  tuesday_subject?: string | null;
  wednesday_subject?: string | null;
  thursday_subject?: string | null;
  friday_subject?: string | null;
};

type SubjectSchedulePayload = Record<keyof typeof DAY_COLUMN_MAP, string>;

type SubjectScheduleResponse = {
  success: boolean;
  schedule: SubjectSchedulePayload | null;
  options: { subjects: string[] };
};

const sanitizeString = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
};

const dedupeSubjects = (values: readonly string[]): string[] => {
  const unique = new Set<string>();
  for (const entry of values) {
    const trimmed = entry?.trim();
    if (trimmed) {
      unique.add(trimmed);
    }
  }
  return Array.from(unique);
};

const extractIdColumn = (columns: Set<string>): (typeof ID_COLUMN_CANDIDATES)[number] | null => {
  for (const candidate of ID_COLUMN_CANDIDATES) {
    if (columns.has(candidate)) {
      return candidate;
    }
  }
  return null;
};

const normalizeSchedule = (row: SubjectScheduleRow | null | undefined): SubjectSchedulePayload | null => {
  if (!row) {
    return null;
  }
  const result = {} as SubjectSchedulePayload;
  for (const [label, column] of Object.entries(DAY_COLUMN_MAP) as Array<[keyof typeof DAY_COLUMN_MAP, string]>) {
    const raw = row[column as keyof SubjectScheduleRow];
    result[label] = typeof raw === "string" ? raw.trim() : "";
  }
  return result;
};

const mergeSubjectOptions = (schedule: SubjectSchedulePayload | null, extra: string[]): string[] => {
  const seeds = [...DEFAULT_SUBJECT_OPTIONS, ...extra];
  if (schedule) {
    seeds.push(...Object.values(schedule));
  }
  return dedupeSubjects(seeds);
};

async function ensureDayColumns(): Promise<{ columns: Set<string>; idColumn: string | null }> {
  const columns = await getTableColumns(SUBJECT_SCHEDULE_TABLE);
  for (const column of Object.values(DAY_COLUMN_MAP)) {
    if (!columns.has(column)) {
      throw new Error(`Column ${column} is missing from ${SUBJECT_SCHEDULE_TABLE}`);
    }
  }
  return { columns, idColumn: extractIdColumn(columns) };
}

export async function GET(): Promise<NextResponse<SubjectScheduleResponse | { success: false; error: string }>> {
  try {
    const { idColumn } = await ensureDayColumns();
    const selectColumns = [idColumn, ...Object.values(DAY_COLUMN_MAP)].filter(Boolean).join(", ");
    const [rows] = await query<SubjectScheduleRow[]>(
      `SELECT ${selectColumns} FROM \`${SUBJECT_SCHEDULE_TABLE}\` LIMIT 1`,
    );

    const schedule = normalizeSchedule(rows[0]);
    const options = mergeSubjectOptions(schedule, []);

    return NextResponse.json({
      success: true,
      schedule,
      options: { subjects: options },
    });
  } catch (error) {
    console.error("Failed to load subject schedule", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load subject schedule.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse<SubjectScheduleResponse | { success: false; error: string }>> {
  try {
    const { columns, idColumn } = await ensureDayColumns();
    const payload = await request.json();
    const scheduleInput = payload?.schedule ?? payload;
    if (!scheduleInput || typeof scheduleInput !== "object") {
      return NextResponse.json({ success: false, error: "Invalid schedule payload." }, { status: 400 });
    }

    const normalized = {} as SubjectSchedulePayload;
    for (const label of Object.keys(DAY_COLUMN_MAP) as Array<keyof typeof DAY_COLUMN_MAP>) {
      normalized[label] = sanitizeString(scheduleInput[label]);
    }

    const values = (Object.entries(DAY_COLUMN_MAP) as Array<[keyof typeof DAY_COLUMN_MAP, string]>).map(([label]) => {
      const subject = normalized[label];
      return subject.length > 0 ? subject : null;
    });

    const selectColumns = [idColumn].filter(Boolean).join(", ");
    const [rows] = await query<SubjectScheduleRow[]>(
      `SELECT ${selectColumns || "1"} FROM \`${SUBJECT_SCHEDULE_TABLE}\` LIMIT 1`,
    );

    if (rows.length > 0) {
      const identifier = idColumn ? rows[0][idColumn as keyof SubjectScheduleRow] : null;
      const updateAssignments = Object.values(DAY_COLUMN_MAP)
        .map((column) => `\`${column}\` = ?`)
        .join(", ");

      if (idColumn && identifier !== undefined && identifier !== null) {
        await query<ResultSetHeader>(
          `UPDATE \`${SUBJECT_SCHEDULE_TABLE}\` SET ${updateAssignments} WHERE \`${idColumn}\` = ? LIMIT 1`,
          [...values, identifier],
        );
      } else {
        await query<ResultSetHeader>(
          `UPDATE \`${SUBJECT_SCHEDULE_TABLE}\` SET ${updateAssignments} LIMIT 1`,
          values,
        );
      }
    } else {
      const insertColumns = Object.values(DAY_COLUMN_MAP)
        .map((column) => `\`${column}\``)
        .join(", ");
      const placeholders = Object.values(DAY_COLUMN_MAP)
        .map(() => "?")
        .join(", ");
      await query<ResultSetHeader>(
        `INSERT INTO \`${SUBJECT_SCHEDULE_TABLE}\` (${insertColumns}) VALUES (${placeholders})`,
        values,
      );
    }

    const options = mergeSubjectOptions(normalized, []);

    return NextResponse.json({
      success: true,
      schedule: normalized,
      options: { subjects: options },
    });
  } catch (error) {
    console.error("Failed to update subject schedule", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update subject schedule.",
      },
      { status: 500 },
    );
  }
}
