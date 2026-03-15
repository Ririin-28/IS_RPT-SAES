import { NextRequest } from "next/server";

describe("profile route auth enforcement", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("teacher profile GET rejects unauthenticated access", async () => {
    jest.doMock("@/lib/server/teacher-session", () => ({
      getTeacherSessionFromCookies: jest.fn().mockResolvedValue(null),
    }));

    const route = await import("../app/api/teacher/profile/route");
    const response = await route.GET(new NextRequest("http://localhost/api/teacher/profile"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Teacher session not found.",
    });
  });

  test("teacher profile GET rejects mismatched userId", async () => {
    jest.doMock("@/lib/server/teacher-session", () => ({
      getTeacherSessionFromCookies: jest.fn().mockResolvedValue({ userId: 10 }),
    }));

    const route = await import("../app/api/teacher/profile/route");
    const response = await route.GET(
      new NextRequest("http://localhost/api/teacher/profile?userId=11"),
    );

    expect(response.status).toBe(403);
  });

  test("principal profile GET rejects unauthenticated access", async () => {
    jest.doMock("@/lib/server/principal-session", () => ({
      getPrincipalSessionFromCookies: jest.fn().mockResolvedValue(null),
    }));

    const route = await import("../app/api/principal/profile/route");
    const response = await route.GET(new NextRequest("http://localhost/api/principal/profile"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Principal session not found.",
    });
  });

  test("principal profile GET rejects mismatched userId", async () => {
    jest.doMock("@/lib/server/principal-session", () => ({
      getPrincipalSessionFromCookies: jest.fn().mockResolvedValue({ userId: 12 }),
    }));

    const route = await import("../app/api/principal/profile/route");
    const response = await route.GET(
      new NextRequest("http://localhost/api/principal/profile?userId=13"),
    );

    expect(response.status).toBe(403);
  });

  test("master teacher profile GET rejects unauthenticated access", async () => {
    jest.doMock("@/lib/server/master-teacher-session", () => ({
      getMasterTeacherSessionFromCookies: jest.fn().mockResolvedValue(null),
    }));

    const route = await import("../app/api/master_teacher/profile/route");
    const response = await route.GET(new NextRequest("http://localhost/api/master_teacher/profile"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Master teacher session not found.",
    });
  });

  test("master teacher profile GET rejects mismatched userId", async () => {
    jest.doMock("@/lib/server/master-teacher-session", () => ({
      getMasterTeacherSessionFromCookies: jest.fn().mockResolvedValue({ userId: 20 }),
    }));

    const route = await import("../app/api/master_teacher/profile/route");
    const response = await route.GET(
      new NextRequest("http://localhost/api/master_teacher/profile?userId=21"),
    );

    expect(response.status).toBe(403);
  });

  test("master teacher coordinator profile GET rejects unauthenticated access", async () => {
    jest.doMock("@/lib/server/master-teacher-session", () => ({
      getMasterTeacherSessionFromCookies: jest.fn().mockResolvedValue(null),
    }));

    const route = await import("../app/api/master_teacher/coordinator/profile/route");
    const response = await route.GET(
      new NextRequest("http://localhost/api/master_teacher/coordinator/profile"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Master teacher session not found.",
    });
  });

  test("master teacher coordinator profile GET rejects mismatched userId", async () => {
    jest.doMock("@/lib/server/master-teacher-session", () => ({
      getMasterTeacherSessionFromCookies: jest.fn().mockResolvedValue({ userId: 22 }),
    }));

    const route = await import("../app/api/master_teacher/coordinator/profile/route");
    const response = await route.GET(
      new NextRequest("http://localhost/api/master_teacher/coordinator/profile?userId=23"),
    );

    expect(response.status).toBe(403);
  });

  test("IT admin profile GET rejects unauthenticated access", async () => {
    jest.doMock("@/lib/server/it-admin-auth", () => ({
      requireItAdmin: jest.fn().mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      }),
    }));

    const route = await import("../app/api/it_admin/profile/route");
    const response = await route.GET(new NextRequest("http://localhost/api/it_admin/profile"));

    expect(response.status).toBe(401);
  });

  test("IT admin profile GET rejects mismatched userId", async () => {
    jest.doMock("@/lib/server/it-admin-auth", () => ({
      requireItAdmin: jest.fn().mockResolvedValue({
        ok: true,
        userId: 30,
      }),
    }));

    const route = await import("../app/api/it_admin/profile/route");
    const response = await route.GET(
      new NextRequest("http://localhost/api/it_admin/profile?userId=31"),
    );

    expect(response.status).toBe(403);
  });
});
