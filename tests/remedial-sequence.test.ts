import { getPriorScheduleBlocksByStudent } from "../lib/server/remedial-sequence";

describe("remedial sequence guard", () => {
  test("blocks a student when an earlier schedule was skipped", async () => {
    const executor = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("WHERE request_id = ?")) {
          return [[
            { request_id: 16, subject_id: 1, grade_id: 3, schedule_date: "2026-03-16" },
          ], []];
        }

        if (sql.includes("ORDER BY schedule_date ASC, request_id ASC")) {
          return [[
            { request_id: 2, schedule_date: "2026-03-02" },
            { request_id: 9, schedule_date: "2026-03-09" },
          ], []];
        }

        return [[
          { student_id: "ST-1", approved_schedule_id: 2, is_completed: 1 },
        ], []];
      }),
    } as any;

    const blocks = await getPriorScheduleBlocksByStudent(executor, 16, ["ST-1"]);

    expect(blocks["ST-1"]).toEqual({
      scheduleId: 9,
      scheduleDate: "2026-03-09",
      message: "This student must complete the March 9, 2026 remedial schedule before starting the March 16, 2026 session.",
    });
  });

  test("allows a student when all earlier schedules are completed", async () => {
    const executor = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("WHERE request_id = ?")) {
          return [[
            { request_id: 16, subject_id: 1, grade_id: 3, schedule_date: "2026-03-16" },
          ], []];
        }

        if (sql.includes("ORDER BY schedule_date ASC, request_id ASC")) {
          return [[
            { request_id: 2, schedule_date: "2026-03-02" },
            { request_id: 9, schedule_date: "2026-03-09" },
          ], []];
        }

        return [[
          { student_id: "ST-1", approved_schedule_id: 2, is_completed: 1 },
          { student_id: "ST-1", approved_schedule_id: 9, is_completed: 1 },
        ], []];
      }),
    } as any;

    const blocks = await getPriorScheduleBlocksByStudent(executor, 16, ["ST-1"]);

    expect(blocks["ST-1"]).toBeNull();
  });
});
