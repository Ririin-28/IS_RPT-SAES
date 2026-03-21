describe("session endpoints auth behavior", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("principal session endpoint returns 401 and clears cookie when session is missing", async () => {
    jest.doMock("@/lib/server/principal-session", () => ({
      getPrincipalSessionFromCookies: jest.fn().mockResolvedValue(null),
      buildClearedPrincipalSessionCookie: jest.fn().mockReturnValue("principal_session=cleared"),
    }));

    const route = await import("../app/api/principal/session/route");
    const response = await route.GET();

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie") || "").toContain("principal_session=cleared");
  });

  test("master teacher session endpoint returns 401 and clears cookie when session is missing", async () => {
    jest.doMock("@/lib/server/master-teacher-session", () => ({
      getMasterTeacherSessionFromCookies: jest.fn().mockResolvedValue(null),
      buildClearedMasterTeacherSessionCookie: jest.fn().mockReturnValue("mt_session=cleared"),
    }));

    const route = await import("../app/api/master_teacher/session/route");
    const response = await route.GET();

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie") || "").toContain("mt_session=cleared");
  });

  test("teacher session endpoint returns 401 and clears cookie when session is missing", async () => {
    jest.doMock("@/lib/server/teacher-session", () => ({
      getTeacherSessionFromCookies: jest.fn().mockResolvedValue(null),
      buildClearedTeacherSessionCookie: jest.fn().mockReturnValue("rpt_teacher_session=cleared"),
    }));

    const route = await import("../app/api/teacher/session/route");
    const response = await route.GET();

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie") || "").toContain("rpt_teacher_session=cleared");
  });
});
