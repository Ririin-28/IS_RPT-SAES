import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { query } from "@/lib/db";
import { getPrincipalSessionFromCookies } from "@/lib/server/principal-session";

export const dynamic = "force-dynamic";

const REMEDIAL_QUARTER_TABLE = "remedial_quarter";
const REMEDIAL_WEEK_TABLE = "remedial_week";

type QuarterRow = RowDataPacket & {
  quarter_id: number;
  school_year: string;
  start_month: number;
  end_month: number;
};

const parseSchoolYear = (schoolYear: string): { startYear: number; endYear: number } | null => {
  const [start, end] = schoolYear.split("-").map((part) => Number(part));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { startYear: start, endYear: end };
};

const yearForMonth = (schoolYear: string, month: number): number | null => {
  const parsed = parseSchoolYear(schoolYear);
  if (!parsed) return null;
  return month >= 6 ? parsed.startYear : parsed.endYear;
};

const buildQuarterRange = (
  schoolYear: string,
  startMonth: number,
  endMonth: number,
): { start: Date; end: Date } | null => {
  const startYear = yearForMonth(schoolYear, startMonth);
  const endYear = yearForMonth(schoolYear, endMonth);
  if (!startYear || !endYear) return null;

  const start = new Date(startYear, startMonth - 1, 1);
  const end = new Date(endYear, endMonth, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const startOfWeekMonday = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  const day = normalized.getDay();
  const diff = (day + 6) % 7;
  normalized.setDate(normalized.getDate() - diff);
  return normalized;
};

const endOfWeekFriday = (weekStart: Date): Date => {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 4);
  end.setHours(23, 59, 59, 999);
  return end;
};

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const resolveWeekNumber = (quarterStart: Date, weekStart: Date): number => {
  const diffMs = weekStart.getTime() - quarterStart.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, diffWeeks + 1);
};

export async function POST(request: NextRequest) {
  try {
    const session = await getPrincipalSessionFromCookies();
    if (!session?.principalId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json().catch(() => null)) as
      | {
          schoolYear?: string | null;
          quarterId?: number | null;
          mode?: "append" | "replace" | null;
        }
      | null;

    const schoolYear = typeof payload?.schoolYear === "string" ? payload?.schoolYear.trim() : "";
    const quarterId = Number.isFinite(payload?.quarterId) ? Number(payload?.quarterId) : null;
    const mode = payload?.mode === "replace" ? "replace" : "append";

    const filters: string[] = [];
    const params: Array<string | number> = [];
    if (schoolYear) {
      filters.push("school_year = ?");
      params.push(schoolYear);
    }
    if (quarterId) {
      filters.push("quarter_id = ?");
      params.push(quarterId);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const [quarters] = await query<QuarterRow[]>(
      `SELECT quarter_id, school_year, start_month, end_month FROM ${REMEDIAL_QUARTER_TABLE} ${where}`,
      params,
    );

    if (!quarters.length) {
      return NextResponse.json(
        { success: false, error: "No remedial quarter records found for the specified filter." },
        { status: 404 },
      );
    }

    let created = 0;
    let skipped = 0;

    for (const quarter of quarters) {
      const startMonth = Number(quarter.start_month);
      const endMonth = Number(quarter.end_month);
      if (!Number.isFinite(startMonth) || !Number.isFinite(endMonth)) {
        continue;
      }

      const range = buildQuarterRange(String(quarter.school_year), startMonth, endMonth);
      if (!range) {
        continue;
      }

      const quarterStart = new Date(range.start);
      const firstWeekStart = startOfWeekMonday(range.start);
      const lastWeekStart = startOfWeekMonday(range.end);

      if (mode === "replace") {
        await query<ResultSetHeader>(
          `DELETE FROM ${REMEDIAL_WEEK_TABLE} WHERE quarter_id = ?`,
          [quarter.quarter_id],
        );
      }

      let weekStart = new Date(firstWeekStart);
      while (weekStart <= lastWeekStart) {
        const weekEnd = endOfWeekFriday(weekStart);
        const weekNumber = resolveWeekNumber(quarterStart, weekStart);

        const [existing] = await query<RowDataPacket[]>(
          `SELECT week_id FROM ${REMEDIAL_WEEK_TABLE} WHERE quarter_id = ? AND week_number = ? LIMIT 1`,
          [quarter.quarter_id, weekNumber],
        );

        if (existing.length) {
          skipped += 1;
        } else {
          await query<ResultSetHeader>(
            `INSERT INTO ${REMEDIAL_WEEK_TABLE} (quarter_id, week_number, week_start_date, week_end_date)
             VALUES (?, ?, ?, ?)`
            ,
            [
              quarter.quarter_id,
              weekNumber,
              formatDate(weekStart),
              formatDate(weekEnd),
            ],
          );
          created += 1;
        }

        weekStart.setDate(weekStart.getDate() + 7);
      }
    }

    return NextResponse.json({
      success: true,
      mode,
      created,
      skipped,
      quarters: quarters.length,
    });
  } catch (error) {
    console.error("Failed to generate remedial weeks", error);
    return NextResponse.json({ success: false, error: "Unable to generate remedial weeks." }, { status: 500 });
  }
}
