import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import { getPrincipalSessionFromCookies } from "@/lib/server/principal-session";

export const dynamic = "force-dynamic";

const WEEKLY_TABLE = "weekly_subject_schedule";
const SUBJECTS_TABLE_CANDIDATES = ["subjects", "subject"] as const;

const VALID_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
type Weekday = typeof VALID_WEEKDAYS[number];

type WeeklyRow = RowDataPacket & {
  day_of_week: Weekday;
  subject_id: number | null;
};

type SubjectRow = RowDataPacket & {
  subject_id: number;
  name?: string | null;
  subject_name?: string | null;
};

type SubjectSchedulePayload = Record<Weekday, string>;

/* ------------------------------- Utilities ------------------------------- */

const DEFAULT_SUBJECTS = ["Assessment", "English", "Filipino", "Math"] as const;
const ALLOWED_SUBJECTS = new Set<string>(DEFAULT_SUBJECTS);

const SUBJECT_NAME_TO_ID: Record<string, number> = DEFAULT_SUBJECTS.reduce((acc, name, idx) => {
  acc[name] = idx + 1;
  return acc;
}, {} as Record<string, number>);

const sanitizeString = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const dedupeStrings = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((v) => v?.trim()).filter(Boolean))) as string[];

async function ensureWeeklyTable(): Promise<void> {
  const columns = await getTableColumns(WEEKLY_TABLE);
  for (const col of ["day_of_week", "subject_id", "created_by"]) {
    if (!columns.has(col)) {
      throw new Error(`Missing column ${col} in ${WEEKLY_TABLE}`);
    }
  }
}

/* ------------------------------ Subjects ------------------------------ */

async function subjectsLookupAvailable() {
  for (const table of SUBJECTS_TABLE_CANDIDATES) {
    try {
      const cols = await getTableColumns(table);
      const idCol = cols.has("subject_id") ? "subject_id" : cols.has("id") ? "id" : null;
      const nameCol = cols.has("name")
        ? "name"
        : cols.has("subject_name")
        ? "subject_name"
        : null;
      if (idCol && nameCol) return { table, idCol, nameCol };
    } catch {}
  }
  return null;
}

async function fetchAllSubjects(): Promise<Array<{ id: number; name: string }>> {
  const lookup = await subjectsLookupAvailable();
  if (!lookup) {
    return DEFAULT_SUBJECTS.map((name, i) => ({ id: i + 1, name }));
  }

  const [rows] = await query<SubjectRow[]>(
    `SELECT \`${lookup.idCol}\` AS subject_id, \`${lookup.nameCol}\` AS name FROM \`${lookup.table}\``,
  );

  return rows
    .map((r) => ({ id: Number(r.subject_id), name: sanitizeString(r.name ?? r.subject_name) }))
    .filter((s) => s.id && ALLOWED_SUBJECTS.has(s.name));
}

async function getSubjectIdByName(name: string): Promise<number | null> {
  const trimmed = sanitizeString(name);
  if (!trimmed || !ALLOWED_SUBJECTS.has(trimmed)) return null;

  const subjects = await fetchAllSubjects();
  return subjects.find((s) => s.name === trimmed)?.id ?? SUBJECT_NAME_TO_ID[trimmed];
}

/* -------------------------------- GET -------------------------------- */

export async function GET(request: NextRequest) {
  try {
    await ensureWeeklyTable();

    const subjects = await fetchAllSubjects();
    const map = new Map(subjects.map((s) => [s.id, s.name]));

    const [rows] = await query<WeeklyRow[]>(
      `SELECT day_of_week, subject_id FROM \`${WEEKLY_TABLE}\``,
    );

    const schedule = VALID_WEEKDAYS.reduce(
      (acc, d) => ({ ...acc, [d]: "" }),
      {} as SubjectSchedulePayload,
    );

    for (const r of rows) {
      if (map.has(r.subject_id!)) schedule[r.day_of_week] = map.get(r.subject_id!)!;
    }

    return NextResponse.json({
      success: true,
      schedule,
      options: { subjects: dedupeStrings(subjects.map((s) => s.name)) },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

/* -------------------------------- PUT -------------------------------- */

export async function PUT(request: NextRequest) {
  try {
    await ensureWeeklyTable();

    const session = await getPrincipalSessionFromCookies();
    if (!session?.principalId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const entries: { day: Weekday; subjectId: number }[] = [];

    for (const day of VALID_WEEKDAYS) {
      const id = await getSubjectIdByName(body?.schedule?.[day]);
      if (!id) {
        return NextResponse.json(
          { success: false, error: `Invalid subject for ${day}` },
          { status: 400 },
        );
      }
      entries.push({ day, subjectId: id });
    }

    await query(`DELETE FROM \`${WEEKLY_TABLE}\``);

    for (const e of entries) {
      await query<ResultSetHeader>(
        `INSERT INTO \`${WEEKLY_TABLE}\`
         (day_of_week, subject_id, created_by, created_at)
         VALUES (?, ?, ?, NOW())`,
        [e.day, e.subjectId, session.principalId],
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

/* ------------------------------- DELETE ------------------------------- */

export async function DELETE(request: NextRequest) {
  try {
    await ensureWeeklyTable();
    await query(`DELETE FROM \`${WEEKLY_TABLE}\``);

    return NextResponse.json({
      success: true,
      schedule: VALID_WEEKDAYS.reduce(
        (a, d) => ({ ...a, [d]: "" }),
        {} as SubjectSchedulePayload,
      ),
      options: { subjects: dedupeStrings(DEFAULT_SUBJECTS) },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
