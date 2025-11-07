import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { normalizeMaterialSubject, type MaterialSubject } from "@/lib/materials/shared";

const COORDINATOR_TABLE = "mt_coordinator";

const SUBJECT_CANDIDATES = [
  "subject_handled",
  "coordinator_subject",
  "coordinator_subject_handled",
  "subjects",
  "subject",
  "handled_subjects",
] as const;

type CoordinatorSubjectRow = RowDataPacket & {
  [key: string]: string | null;
};

export async function resolveCoordinatorSubject(userId: number): Promise<MaterialSubject | null> {
  if (!Number.isFinite(userId) || userId <= 0) {
    return null;
  }

  try {
    const [rows] = await query<CoordinatorSubjectRow[]>(
      `SELECT * FROM \`${COORDINATOR_TABLE}\` WHERE user_id = ? LIMIT 1`,
      [userId],
    );
    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    for (const candidate of SUBJECT_CANDIDATES) {
      const value = row[candidate];
      if (typeof value === "string" && value.trim().length > 0) {
        const subject = normalizeMaterialSubject(value);
        if (subject) {
          return subject;
        }
      }
    }
  } catch (error) {
    console.error("Failed to resolve coordinator subject", error);
  }

  return null;
}
