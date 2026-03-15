import { resolveAuthorizedProfileUserId } from "../lib/server/profile-request";

describe("resolveAuthorizedProfileUserId", () => {
  test("uses the authenticated user id when no query param is provided", () => {
    const result = resolveAuthorizedProfileUserId(null, 42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe(42);
    }
  });

  test("rejects invalid user ids", async () => {
    const result = resolveAuthorizedProfileUserId("abc", 42);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      await expect(result.response.json()).resolves.toMatchObject({
        success: false,
        error: "Invalid userId value.",
      });
    }
  });

  test("rejects access to another user's profile", async () => {
    const result = resolveAuthorizedProfileUserId("41", 42);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      await expect(result.response.json()).resolves.toMatchObject({
        success: false,
        error: "You are not authorized to access another user's profile.",
      });
    }
  });
});
