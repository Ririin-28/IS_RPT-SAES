describe("logout session cookie clearing", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("logout clears all role session cookies when tokens are present", async () => {
    const execute = jest.fn().mockResolvedValue([[]]);
    const end = jest.fn().mockResolvedValue(undefined);

    jest.doMock("mysql2/promise", () => ({
      __esModule: true,
      default: {
        createConnection: jest.fn().mockResolvedValue({ execute, end }),
      },
    }));

    jest.doMock("@/lib/server/account-logs", () => ({
      recordAccountLogout: jest.fn().mockResolvedValue(undefined),
    }));

    jest.doMock("@/lib/server/parent-session", () => ({
      extractParentSessionToken: jest.fn().mockReturnValue("parent-token"),
      revokeParentSession: jest.fn().mockResolvedValue(10),
      buildClearedParentSessionCookie: jest.fn().mockReturnValue("parent_cookie=cleared"),
    }));

    jest.doMock("@/lib/server/admin-session", () => ({
      extractAdminSessionToken: jest.fn().mockReturnValue("admin-token"),
      revokeAdminSession: jest.fn().mockResolvedValue(11),
      buildClearedAdminSessionCookie: jest.fn().mockReturnValue("admin_cookie=cleared"),
    }));

    jest.doMock("@/lib/server/principal-session", () => ({
      extractPrincipalSessionToken: jest.fn().mockReturnValue("principal-token"),
      revokePrincipalSessionByToken: jest.fn().mockResolvedValue(12),
      buildClearedPrincipalSessionCookie: jest.fn().mockReturnValue("principal_cookie=cleared"),
    }));

    jest.doMock("@/lib/server/master-teacher-session", () => ({
      extractMasterTeacherSessionToken: jest.fn().mockReturnValue("mt-token"),
      revokeMasterTeacherSessionByToken: jest.fn().mockResolvedValue(13),
      buildClearedMasterTeacherSessionCookie: jest.fn().mockReturnValue("mt_cookie=cleared"),
    }));

    jest.doMock("@/lib/server/teacher-session", () => ({
      extractTeacherSessionToken: jest.fn().mockReturnValue("teacher-token"),
      revokeTeacherSessionByToken: jest.fn().mockResolvedValue(14),
      buildClearedTeacherSessionCookie: jest.fn().mockReturnValue("teacher_cookie=cleared"),
    }));

    const route = await import("../app/api/auth/logout/route");
    const response = await route.POST(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: "any=1" },
        body: JSON.stringify({ userId: null }),
      }),
    );

    expect(response.status).toBe(200);
    const setCookieHeader = response.headers.get("set-cookie") || "";
    expect(setCookieHeader).toContain("parent_cookie=cleared");
    expect(setCookieHeader).toContain("admin_cookie=cleared");
    expect(setCookieHeader).toContain("principal_cookie=cleared");
    expect(setCookieHeader).toContain("mt_cookie=cleared");
    expect(setCookieHeader).toContain("teacher_cookie=cleared");
  });
});
