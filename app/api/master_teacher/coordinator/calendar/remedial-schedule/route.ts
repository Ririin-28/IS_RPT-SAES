import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { getPrincipalSessionFromCookies } from "@/lib/server/principal-session";

export const dynamic = "force-dynamic";

const REMEDIAL_QUARTER_TABLE = "remedial_quarter";
const APPROVED_REMEDIAL_TABLE = "approved_remedial_schedule";
const REQUEST_REMEDIAL_TABLE = "request_remedial_schedule";
const QUARTER_VALUES = ["1st Quarter", "2nd Quarter"] as const;
type QuarterValue = (typeof QUARTER_VALUES)[number];

type QuarterRange = {
  startMonth: number | null;
  endMonth: number | null;
};

type RemedialQuarterSchedule = {
  schoolYear: string;
  quarters: Record<QuarterValue, QuarterRange>;
};

type RemedialQuarterRow = RowDataPacket & {
  quarter_id: number;
  school_year: string;
  quarter_name: string;
  start_month: number | null;
  end_month: number | null;
  created_by?: number | null;
  created_at?: string | null;
};

const normalizeUserCode = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
};

async function resolveUserCodeFromUserId(userId: number): Promise<number | null> {
  const [rows] = await query<RowDataPacket[]>(
    "SELECT user_code FROM users WHERE user_id = ? LIMIT 1",
    [userId],
  );
  if (!rows.length) return null;
  return normalizeUserCode(rows[0]?.user_code);
}

const normalizeQuarterName = (value: unknown): QuarterValue | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith("1") || normalized.includes("first")) return "1st Quarter";
  if (normalized.startsWith("2") || normalized.includes("second")) return "2nd Quarter";
  if (normalized === "1st quarter") return "1st Quarter";
  if (normalized === "2nd quarter") return "2nd Quarter";
  return null;
};

const resolveSchoolYear = (value: unknown): string => {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  // Default: school year rolls over in June
  if (month >= 5) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
};

const sanitizeMonth = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const truncated = Math.trunc(numeric);
  if (truncated >= 1 && truncated <= 12) return truncated;
  if (truncated >= 0 && truncated <= 11) return truncated + 1;
  return null;
};

const emptySchedule = (schoolYear: string): RemedialQuarterSchedule => ({
  schoolYear,
  quarters: {
    "1st Quarter": { startMonth: null, endMonth: null },
    "2nd Quarter": { startMonth: null, endMonth: null },
  },
});

const loadSchedule = async (schoolYear: string): Promise<RemedialQuarterSchedule | null> => {
  const [rows] = await query<RemedialQuarterRow[]>(
    `SELECT quarter_id, school_year, quarter_name, start_month, end_month FROM \`${REMEDIAL_QUARTER_TABLE}\` WHERE school_year = ?`,
    [schoolYear],
  );

  if (!rows.length) return null;

  const schedule = emptySchedule(schoolYear);
  for (const row of rows) {
    const quarter = normalizeQuarterName(row.quarter_name);
    if (!quarter) continue;
    schedule.quarters[quarter] = {
      startMonth: sanitizeMonth(row.start_month),
      endMonth: sanitizeMonth(row.end_month),
    };
  }

  return schedule;
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const schoolYear = resolveSchoolYear(url.searchParams.get("school_year"));
    const schedule = await loadSchedule(schoolYear);
    return NextResponse.json({ success: true, schedule });
  } catch (error) {
    console.error("Failed to load remedial quarter schedule", error);
    return NextResponse.json({ success: false, error: "Remedial quarter schedule is unavailable." }, { status: 500 });
  }
}

type RemedialQuarterPayload = {
  schoolYear: string;
  quarters: Record<QuarterValue, { startMonth: number | null; endMonth: number | null }>;
  createdBy?: number | null;
  createdByUserId?: number | null;
};

const normalizePayload = (payload: unknown): RemedialQuarterPayload => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload.");
  }
  const input = payload as Record<string, unknown>;
  const schoolYear = resolveSchoolYear(input.schoolYear ?? input.school_year);
  const quartersInput = input.quarters as Record<string, { startMonth?: unknown; endMonth?: unknown }> | undefined;
  const quarters: Record<QuarterValue, QuarterRange> = {
    "1st Quarter": { startMonth: null, endMonth: null },
    "2nd Quarter": { startMonth: null, endMonth: null },
  };

  for (const quarter of QUARTER_VALUES) {
    const raw = quartersInput?.[quarter];
    const startMonth = sanitizeMonth(raw?.startMonth);
    const endMonth = sanitizeMonth(raw?.endMonth);
    if (startMonth && endMonth && startMonth > endMonth) {
      throw new Error(`${quarter}: start month must be before end month.`);
    }
    quarters[quarter] = { startMonth, endMonth };
  }

  const createdBy = normalizeUserCode(input.createdBy ?? input.created_by);
  const createdByUserId = normalizeUserCode(input.createdByUserId ?? input.created_by_user_id);

  return { schoolYear, quarters, createdBy, createdByUserId };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = normalizePayload(body);
    const session = await getPrincipalSessionFromCookies();
    let createdBy = payload.createdBy;
    if (!createdBy && payload.createdByUserId) {
      createdBy = await resolveUserCodeFromUserId(payload.createdByUserId);
      if (!createdBy && payload.createdByUserId) {
        createdBy = payload.createdByUserId;
      }
    }
    if (!createdBy && session?.userId) {
      createdBy = await resolveUserCodeFromUserId(session.userId);
      if (!createdBy) {
        createdBy = session.userId;
      }
    }
    if (!createdBy) {
      return NextResponse.json(
        { success: false, error: "Principal session not found. Please sign in again." },
        { status: 401 },
      );
    }

    const [existingRows] = await query<RemedialQuarterRow[]>(
      `SELECT quarter_id, quarter_name FROM \`${REMEDIAL_QUARTER_TABLE}\` WHERE school_year = ?`,
      [payload.schoolYear],
    );
    const existingByQuarter = new Map<QuarterValue, number>();
    for (const row of existingRows) {
      const quarter = normalizeQuarterName(row.quarter_name);
      if (quarter) {
        existingByQuarter.set(quarter, row.quarter_id);
      }
    }

    for (const quarter of QUARTER_VALUES) {
      const range = payload.quarters[quarter];
      const existingId = existingByQuarter.get(quarter) ?? null;
      if (existingId) {
        await query(
          `UPDATE \`${REMEDIAL_QUARTER_TABLE}\` SET start_month = ?, end_month = ? WHERE quarter_id = ? LIMIT 1`,
          [range.startMonth, range.endMonth, existingId],
        );
      } else {
        await query(
          `INSERT INTO \`${REMEDIAL_QUARTER_TABLE}\` (school_year, quarter_name, start_month, end_month, created_by, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
          [payload.schoolYear, quarter, range.startMonth, range.endMonth, createdBy],
        );
      }
    }

    const schedule = await loadSchedule(payload.schoolYear);
    return NextResponse.json({ success: true, schedule });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save remedial quarter schedule.";
    console.error("Failed to save remedial quarter schedule", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const schoolYear = resolveSchoolYear(url.searchParams.get("school_year"));
    await query(`DELETE FROM \`${REMEDIAL_QUARTER_TABLE}\` WHERE school_year = ?`, [schoolYear]);
    try {
      await query(`DELETE FROM \`${APPROVED_REMEDIAL_TABLE}\``);
    } catch (activityError) {
      console.warn("Unable to clear approved remedial activities", activityError);
    }
    try {
      await query(`DELETE FROM \`${REQUEST_REMEDIAL_TABLE}\``);
    } catch (requestError) {
      console.warn("Unable to clear pending remedial requests", requestError);
    }
    return NextResponse.json({ success: true, schedule: null });
  } catch (error) {
    console.error("Failed to delete remedial quarter schedule", error);
    return NextResponse.json({ success: false, error: "Unable to delete remedial quarter schedule." }, { status: 500 });
  }
}
