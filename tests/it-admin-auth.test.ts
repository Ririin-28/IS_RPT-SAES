import { normalizeRequestedItAdminPermission } from "../lib/server/it-admin-permissions";

describe("IT admin auth permission normalization", () => {
  test("maps legacy super_admin permissions to canonical it_admin permissions", () => {
    expect(normalizeRequestedItAdminPermission("super_admin:accounts.manage")).toBe("it_admin:accounts.manage");
    expect(normalizeRequestedItAdminPermission("super_admin:logs.view")).toBe("it_admin:logs.view");
  });

  test("keeps canonical permissions unchanged", () => {
    expect(normalizeRequestedItAdminPermission("it_admin:profile.manage")).toBe("it_admin:profile.manage");
  });

  test("returns undefined when no permission is requested", () => {
    expect(normalizeRequestedItAdminPermission()).toBeUndefined();
  });
});
