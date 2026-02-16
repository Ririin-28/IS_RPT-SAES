import {
  findRecoveryEntity,
  modeFlagColumn,
  modeReasonColumn,
  modeTimeColumn,
  pickLabelColumns,
} from "../lib/server/recovery-center";

describe("recovery center config", () => {
  test("finds known recovery entities", () => {
    const student = findRecoveryEntity("student");
    const attendance = findRecoveryEntity("attendance_record");

    expect(student?.table).toBe("student");
    expect(student?.idColumn).toBe("student_id");
    expect(attendance?.mode).toBe("voided");
  });

  test("returns null for unknown entities", () => {
    expect(findRecoveryEntity("unknown_entity")).toBeNull();
  });

  test("maps flag/time/reason columns by mode", () => {
    expect(modeFlagColumn("deleted")).toBe("is_deleted");
    expect(modeTimeColumn("deleted")).toBe("deleted_at");
    expect(modeReasonColumn("deleted")).toBe("delete_reason");

    expect(modeFlagColumn("archived")).toBe("is_archived");
    expect(modeTimeColumn("archived")).toBe("archived_at");
    expect(modeReasonColumn("archived")).toBe("reason");

    expect(modeFlagColumn("voided")).toBe("is_voided");
    expect(modeTimeColumn("voided")).toBe("voided_at");
    expect(modeReasonColumn("voided")).toBe("void_reason");
  });

  test("picks defaults and falls back to common label columns", () => {
    const withDefaults = pickLabelColumns(new Set(["first_name", "last_name", "lrn"]), ["first_name", "last_name"]);
    expect(withDefaults).toEqual(["first_name", "last_name"]);

    const fallback = pickLabelColumns(new Set(["email", "title"]), ["missing_one", "missing_two"]);
    expect(fallback).toEqual(["title", "email"]);
  });
});
