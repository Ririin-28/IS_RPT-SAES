export type RecoveryMode = "deleted" | "archived" | "voided";

export type RecoveryEntityConfig = {
  key: string;
  table: string;
  idColumn: string;
  mode: RecoveryMode;
  defaultLabelColumns: string[];
};

const ARCHIVE_BACKED_ACCOUNT_ROLES: Record<string, string[]> = {
  principal: ["principal"],
  master_teacher: ["master_teacher", "masterteacher"],
  teacher: ["teacher"],
};

export const RECOVERY_ENTITIES: RecoveryEntityConfig[] = [
  { key: "student", table: "student", idColumn: "student_id", mode: "deleted", defaultLabelColumns: ["first_name", "last_name", "lrn"] },
  { key: "principal", table: "principal", idColumn: "principal_id", mode: "deleted", defaultLabelColumns: ["principal_id"] },
  { key: "master_teacher", table: "master_teacher", idColumn: "master_teacher_id", mode: "deleted", defaultLabelColumns: ["master_teacher_id"] },
  { key: "teacher", table: "teacher", idColumn: "teacher_id", mode: "deleted", defaultLabelColumns: ["teacher_id"] },
  { key: "parent", table: "parent", idColumn: "parent_id", mode: "deleted", defaultLabelColumns: ["parent_id"] },
  { key: "activity", table: "activities", idColumn: "activity_id", mode: "archived", defaultLabelColumns: ["title", "subject", "type"] },
  { key: "remedial_quarter", table: "remedial_quarter", idColumn: "quarter_id", mode: "archived", defaultLabelColumns: ["quarter_name", "school_year"] },
  { key: "weekly_subject_schedule", table: "weekly_subject_schedule", idColumn: "schedule_id", mode: "archived", defaultLabelColumns: ["day_of_week"] },
  { key: "assessment", table: "assessments", idColumn: "assessment_id", mode: "archived", defaultLabelColumns: ["title", "description"] },
  { key: "attendance_record", table: "attendance_record", idColumn: "attendance_id", mode: "voided", defaultLabelColumns: ["student_id", "remarks"] },
  { key: "performance_record", table: "performance_records", idColumn: "record_id", mode: "voided", defaultLabelColumns: ["student_id", "grade"] },
];

export function findRecoveryEntity(key: string): RecoveryEntityConfig | null {
  const normalized = key.trim().toLowerCase();
  return RECOVERY_ENTITIES.find((entry) => entry.key === normalized) ?? null;
}

export function isArchiveBackedAccountEntity(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(ARCHIVE_BACKED_ACCOUNT_ROLES, key);
}

export function archiveRoleFiltersForEntity(key: string): string[] {
  const values = ARCHIVE_BACKED_ACCOUNT_ROLES[key] ?? [];
  return Array.from(new Set(values.map((value) => normalizeRoleToken(value)).filter((value) => value.length > 0)));
}

export function normalizeRoleToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s/-]+/g, "_");
}

export function modeFlagColumn(mode: RecoveryMode): string {
  if (mode === "deleted") return "is_deleted";
  if (mode === "archived") return "is_archived";
  return "is_voided";
}

export function modeTimeColumn(mode: RecoveryMode): string {
  if (mode === "deleted") return "deleted_at";
  if (mode === "archived") return "archived_at";
  return "voided_at";
}

export function modeReasonColumn(mode: RecoveryMode): string {
  if (mode === "deleted") return "delete_reason";
  if (mode === "archived") return "reason";
  return "void_reason";
}

export function pickLabelColumns(columns: Set<string>, defaults: string[]): string[] {
  const picked: string[] = [];
  for (const col of defaults) {
    if (columns.has(col)) {
      picked.push(col);
    }
  }
  if (picked.length > 0) {
    return picked;
  }
  for (const fallback of ["name", "title", "description", "username", "email", "subject"]) {
    if (columns.has(fallback)) {
      picked.push(fallback);
    }
  }
  return picked;
}
